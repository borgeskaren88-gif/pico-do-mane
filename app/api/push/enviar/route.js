import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { usuarios } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase';
import { VAPID_PUBLIC } from '../../../../lib/push';

// Endpoint chamado 1x por dia pela Vercel (cron). Manda pra cada pessoa:
//  - os lembretes do caderno que venceram (hoje/atrasados) e ainda não avisados;
//  - as tarefas do quadro com data marcada pra hoje (ou atrasadas), ainda não
//    concluídas nem avisadas.
// Protegido pelo CRON_SECRET (a Vercel manda no cabeçalho Authorization).
export const dynamic = 'force-dynamic';

const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  return request.headers.get('authorization') === `Bearer ${segredo}`;
}

async function enviarPra(subs, payload) {
  let enviados = 0;
  const mortas = [];
  for (const s of subs) {
    try { await webpush.sendNotification(s, payload); enviados += 1; }
    catch (e) { if (e?.statusCode === 404 || e?.statusCode === 410) mortas.push(s.endpoint); }
  }
  return { enviados, mortas };
}

export async function GET(request) {
  if (!autorizado(request)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) return NextResponse.json({ ok: false, erro: 'Faltando VAPID_PRIVATE_KEY.' }, { status: 500 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:nossacasa@app.local', VAPID_PUBLIC, priv);

  const hoje = hojeBR();
  const sb = supabaseServer();
  const us = usuarios();
  let enviados = 0;

  // 1) Junta as inscrições de cada pessoa (do caderno privado) e avisa os
  //    lembretes vencidos.
  const subsPorNome = {};
  for (const u of us) {
    const chave = `caderno:${u.id}`;
    const { data } = await sb.from('casa_dados').select('valor').eq('chave', chave).maybeSingle();
    const cad = data?.valor;
    if (!cad) continue;
    const subs = Array.isArray(cad.pushSubs) ? cad.pushSubs : [];
    subsPorNome[u.nome] = { chave, cad, subs };
    if (subs.length === 0) continue;

    const lembretes = Array.isArray(cad.lembretes) ? cad.lembretes : [];
    const devidos = lembretes.filter((l) => l && !l.feito && !l.notificado && l.data && l.data <= hoje);
    let mortasTot = [];
    if (devidos.length > 0) {
      const n = devidos.length === 1
        ? { titulo: 'Lembrete', corpo: devidos[0].texto, tag: `lem-${devidos[0].id}` }
        : { titulo: `${devidos.length} lembretes pra hoje`, corpo: devidos.map((l) => l.texto).slice(0, 4).join(' · '), tag: 'lem-resumo' };
      const r = await enviarPra(subs, JSON.stringify({ ...n, url: '/?aba=caderno' }));
      enviados += r.enviados; mortasTot = r.mortas;
    }
    const ids = new Set(devidos.map((l) => l.id));
    const subsVivas = subs.filter((s) => !mortasTot.includes(s.endpoint));
    if (devidos.length > 0 || subsVivas.length !== subs.length) {
      const novo = { ...cad, lembretes: lembretes.map((l) => ids.has(l.id) ? { ...l, notificado: true } : l), pushSubs: subsVivas };
      await sb.from('casa_dados').upsert({ chave, valor: novo, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      subsPorNome[u.nome].subs = subsVivas;
    }
  }

  // 2) Tarefas do quadro (compartilhado) com data marcada. Aurora avisa as duas.
  const nomeDe = { karen: us[0]?.nome, mariele: us[1]?.nome };
  const { data: casaRow } = await sb.from('casa_dados').select('valor').eq('chave', 'casa').maybeSingle();
  const casa = casaRow?.valor;
  const tarefas = casa && Array.isArray(casa.tarefas) ? casa.tarefas : [];
  const devidasT = tarefas.filter((t) => t && t.data && !t.notificado && (Number(t.feitos) || 0) < t.meta && t.data <= hoje);
  if (devidasT.length > 0) {
    const avisadas = new Set();
    for (const nome of Object.values(nomeDe).filter(Boolean)) {
      const alvo = subsPorNome[nome];
      if (!alvo || alvo.subs.length === 0) continue;
      // Tarefas dessa pessoa (por nome) + as da Aurora (valem pras duas).
      const suas = devidasT.filter((t) => nomeDe[t.pessoa] === nome || t.pessoa === 'aurora');
      if (suas.length === 0) continue;
      const linha = (t) => `${t.titulo}${t.hora ? ` às ${t.hora}` : ''}`;
      const n = suas.length === 1
        ? { titulo: 'Tarefa de hoje', corpo: linha(suas[0]), tag: `tar-${suas[0].id}` }
        : { titulo: `${suas.length} tarefas pra hoje`, corpo: suas.map(linha).slice(0, 4).join(' · '), tag: 'tar-resumo' };
      const r = await enviarPra(alvo.subs, JSON.stringify({ ...n, url: '/?aba=tarefas' }));
      enviados += r.enviados;
      suas.forEach((t) => avisadas.add(t.id));
    }
    if (avisadas.size > 0) {
      const novo = { ...casa, tarefas: tarefas.map((t) => avisadas.has(t.id) ? { ...t, notificado: true } : t) };
      await sb.from('casa_dados').upsert({ chave: 'casa', valor: novo, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
    }
  }

  return NextResponse.json({ ok: true, enviados });
}
