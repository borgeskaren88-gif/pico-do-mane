import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { usuarios } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase';
import { VAPID_PUBLIC } from '../../../../lib/push';

// Endpoint chamado 1x por dia pela Vercel (cron). Percorre o caderno de cada
// pessoa, acha os lembretes que venceram (hoje ou atrasados) e ainda não foram
// avisados, e manda a notificação pros aparelhos daquela pessoa. Protegido pelo
// CRON_SECRET (a Vercel manda ele no cabeçalho Authorization).
export const dynamic = 'force-dynamic';

const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function autorizado(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false; // sem segredo configurado, não envia
  return request.headers.get('authorization') === `Bearer ${segredo}`;
}

export async function GET(request) {
  if (!autorizado(request)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) return NextResponse.json({ ok: false, erro: 'Faltando VAPID_PRIVATE_KEY.' }, { status: 500 });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:nossacasa@app.local', VAPID_PUBLIC, priv);

  const hoje = hojeBR();
  const sb = supabaseServer();
  let enviados = 0;

  for (const u of usuarios()) {
    const chave = `caderno:${u.id}`;
    const { data } = await sb.from('casa_dados').select('valor').eq('chave', chave).maybeSingle();
    const cad = data?.valor;
    if (!cad) continue;
    const lembretes = Array.isArray(cad.lembretes) ? cad.lembretes : [];
    const subs = Array.isArray(cad.pushSubs) ? cad.pushSubs : [];
    if (subs.length === 0) continue;

    const devidos = lembretes.filter((l) => l && !l.feito && !l.notificado && l.data && l.data <= hoje);
    if (devidos.length === 0) continue;

    // Monta a mensagem (um lembrete = uma notificação; vários = uma resumo).
    const notificacoes = devidos.length === 1
      ? [{ titulo: 'Lembrete', corpo: devidos[0].texto, tag: `lem-${devidos[0].id}` }]
      : [{ titulo: `${devidos.length} lembretes pra hoje`, corpo: devidos.map((l) => l.texto).slice(0, 4).join(' · '), tag: 'lem-resumo' }];

    const subsVivas = [...subs];
    for (const n of notificacoes) {
      const payload = JSON.stringify({ ...n, url: '/?aba=caderno' });
      for (const s of subs) {
        try {
          await webpush.sendNotification(s, payload);
          enviados += 1;
        } catch (e) {
          // Assinatura expirada/inválida: remove do caderno.
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            const idx = subsVivas.findIndex((x) => x.endpoint === s.endpoint);
            if (idx >= 0) subsVivas.splice(idx, 1);
          }
        }
      }
    }

    // Marca os devidos como avisados e salva (+ limpa assinaturas mortas).
    const ids = new Set(devidos.map((l) => l.id));
    const novo = { ...cad, lembretes: lembretes.map((l) => ids.has(l.id) ? { ...l, notificado: true } : l), pushSubs: subsVivas };
    await sb.from('casa_dados').upsert({ chave, valor: novo, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  }

  return NextResponse.json({ ok: true, enviados });
}
