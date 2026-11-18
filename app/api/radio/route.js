import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao, acessoDaSessao } from '../../../lib/auth';
import { bancoDaSessao } from '../../../lib/negocioAtual';
import { enviarPush } from '../../../lib/push';
import { acessoFechado } from '../../../lib/senha';
import { lerNegocio, nomeDoPapel } from '../../../lib/negocio';
import {
  PAPEIS_RADIO, PREFIXO, VALIDADE_MS, MAX_SEGUNDOS, destinosDoRadio, audienciaDo, podeOuvir, conferirAudio, idDoRecado, horaDoId,
} from '../../../lib/radio';

export const dynamic = 'force-dynamic';

// O RÁDIO. As regras estão em lib/radio.js; aqui é só guardar, avisar e
// entregar. Todo mundo da equipe fala e ouve — mas cada recado só é entregue
// a quem ele foi mandado.

function quem() {
  const v = cookies().get(nomeCookie())?.value;
  const papel = papelDaSessao(v);
  if (!PAPEIS_RADIO.includes(papel)) return null;
  return { papel, acesso: acessoDaSessao(v) };
}

const primeiro = (s) => String(s || '').trim().split(/\s+/)[0] || '';

// Os nomes pra tela e pra notificação: "Karen", "Sarah", "Cozinha"...
async function nomes(sb) {
  const [{ data: p }, { data: j }] = await Promise.all([
    sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle(),
    sb.from('pdm_dados').select('valor').eq('chave', 'jornadas').maybeSingle(),
  ]);
  const neg = lerNegocio(p?.valor || {});
  const jornadas = j?.valor || {};
  const n = {};
  for (const papel of PAPEIS_RADIO) n[papel] = nomeDoPapel(neg, papel);
  // A gerente é uma pessoa só: o nome dela (da jornada no Ponto) vale mais
  // que o nome do cargo.
  if (jornadas.gerente && primeiro(jornadas.gerente.nome)) n.gerente = primeiro(jornadas.gerente.nome);
  return n;
}

async function recadosGuardados(sb) {
  const { data, error } = await sb.from('pdm_dados').select('chave').like('chave', `${PREFIXO}%`);
  if (error) throw error;
  return (data || []).map((r) => String(r.chave).slice(PREFIXO.length));
}

// GET            — pra quem dá pra falar, e os recados do último dia (sem o áudio).
// GET ?id=...    — um recado, com o áudio (só se ele foi mandado pra quem pede).
export async function GET(request) {
  const eu = quem();
  if (!eu) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = bancoDaSessao();
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      if (!/^\d{13}-[a-z0-9]+$/.test(id)) return NextResponse.json({ ok: false, erro: 'Recado não encontrado.' }, { status: 404 });
      const { data } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id).maybeSingle();
      const r = data?.valor;
      if (!r || !podeOuvir(r, eu.papel)) return NextResponse.json({ ok: false, erro: 'Recado não encontrado.' }, { status: 404 });
      return NextResponse.json({ ok: true, recado: r });
    }
    const n = await nomes(sb);
    const fechados = [];
    for (const p of ['gerente']) { try { if (await acessoFechado(sb, p)) fechados.push(p); } catch { /* sem fechar */ } }
    const ids = (await recadosGuardados(sb)).filter((x) => Date.now() - horaDoId(x) < VALIDADE_MS).sort().reverse().slice(0, 30);
    const recados = [];
    if (ids.length) {
      const { data } = await sb.from('pdm_dados').select('valor').in('chave', ids.map((x) => PREFIXO + x));
      for (const row of data || []) {
        const r = row?.valor;
        if (r && podeOuvir(r, eu.papel)) recados.push({ id: r.id, de: r.de, deNome: r.deNome, para: r.para, paraNome: r.paraNome, segundos: r.segundos, ts: r.ts });
      }
      recados.sort((a, b) => b.ts - a.ts);
    }
    return NextResponse.json({ ok: true, eu: eu.papel, destinos: destinosDoRadio({ eu: eu.papel, nomes: n, fechados }), recados: recados.slice(0, 15), maxSegundos: MAX_SEGUNDOS });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro no rádio.' }, { status: 500 });
  }
}

// POST { para, audio (base64 de WAV), segundos, excluir } — manda um recado.
export async function POST(request) {
  const eu = quem();
  if (!eu) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'O recado chegou estragado.' }, { status: 400 }); }
  const para = String(body?.para || '');
  const audiencia = audienciaDo(para, eu.papel);
  if (!audiencia.length) return NextResponse.json({ ok: false, erro: 'Escolhe pra quem é o recado.' }, { status: 400 });
  const erroAudio = conferirAudio(body?.audio);
  if (erroAudio) return NextResponse.json({ ok: false, erro: erroAudio }, { status: 400 });
  const segundos = Math.max(0, Math.min(MAX_SEGUNDOS + 1, Math.round(Number(body?.segundos) * 10) / 10 || 0));
  if (segundos < 0.4) return NextResponse.json({ ok: false, erro: 'Ficou curtinho demais. Segura o botão enquanto fala.' }, { status: 400 });

  try {
    const sb = bancoDaSessao();
    const n = await nomes(sb);
    const deNome = eu.acesso === 'extra' ? 'Extra' : (n[eu.papel] || eu.papel);
    const paraNome = para === 'todos' ? 'Todos' : (n[para] || para);
    const id = idDoRecado();
    const recado = { id, de: eu.papel, deNome, para, paraNome, segundos, ts: Date.now(), mime: 'audio/wav', audio: String(body.audio) };
    const { error } = await sb.from('pdm_dados').upsert({ chave: PREFIXO + id, valor: recado, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
    if (error) throw error;

    // Os de mais de um dia vão embora aqui mesmo — o rádio não junta
    // áudio velho no banco.
    try {
      const velhos = (await recadosGuardados(sb)).filter((x) => Date.now() - horaDoId(x) >= VALIDADE_MS);
      if (velhos.length) await sb.from('pdm_dados').delete().in('chave', velhos.map((x) => PREFIXO + x));
    } catch { /* limpar nunca impede o recado */ }

    // A notificação acorda o celular de quem deve ouvir. Com o PicoOS aberto,
    // o próprio app toca o recado sozinho; com a tela apagada, ela fica ali
    // pra tocar. O celular de quem falou fica de fora.
    let enviados = 0;
    try {
      const r = await enviarPush(sb, {
        titulo: `🎙️ ${deNome}${para === 'todos' ? ' (pra todos)' : ''}`,
        corpo: `Recado de voz · ${String(segundos).replace('.', ',')} s — toca pra ouvir`,
        url: '/?radio=' + id,
        tag: 'radio-' + id,
        dados: { radio: id },
        audiencia,
        excluirChave: String(body?.excluir || '').slice(0, 200),
      });
      enviados = r?.enviados || 0;
    } catch { /* o recado fica guardado mesmo sem push */ }
    return NextResponse.json({ ok: true, id, enviados, paraNome });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Não consegui mandar o recado.' }, { status: 500 });
  }
}
