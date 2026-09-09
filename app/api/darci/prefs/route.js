import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../../lib/auth';
import { supabaseServer } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Os ajustes do Darci (nome, tom, jeito de falar, qual voz) ficavam guardados
// dentro do navegador — por isso o que a dona regulava no notebook não chegava
// no celular. Agora eles ficam aqui, e todo aparelho lê os mesmos.
//
// Fica de fora o "atender quando eu chamar", que é de cada aparelho: o
// microfone aberto gasta bateria e nem todo navegador deixa escutar.
const CHAVE = 'darciVoz';

const ehDona = () => papelDaSessao(cookies().get(nomeCookie())?.value) === 'dona';

// Só deixa passar o que a gente conhece, do jeito certo — nada de campo solto.
function limpar(p) {
  const out = {};
  if (!p || typeof p !== 'object') return out;
  if (typeof p.nome === 'string') out.nome = p.nome.slice(0, 40).trim();
  const tom = Number(p.tom);
  if (Number.isFinite(tom) && tom >= 0.5 && tom <= 1.2) out.tom = tom;
  if (p.sotaque === 'leve' || p.sotaque === 'manezinho' || p.sotaque === 'carregado') out.sotaque = p.sotaque;
  if (typeof p.vozId === 'string') out.vozId = p.vozId.slice(0, 300);
  // O nome legível ("Microsoft Daniel") serve pra o celular conseguir dizer
  // QUAL voz foi escolhida no computador, mesmo não tendo ela instalada.
  if (typeof p.vozNome === 'string') out.vozNome = p.vozNome.slice(0, 120);
  if (p.motor === 'exclusiva' || p.motor === 'aparelho') out.motor = p.motor;
  return out;
}

export async function GET() {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    return NextResponse.json({ ok: true, prefs: limpar(data?.valor) });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao ler os ajustes.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const novo = limpar(body?.prefs);
  if (!Object.keys(novo).length) return NextResponse.json({ ok: false, erro: 'Nada pra salvar.' }, { status: 400 });
  try {
    const sb = supabaseServer();
    const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
    // Junta com o que já estava: quem mexeu só no tom não apaga o resto.
    const prefs = { ...limpar(data?.valor), ...novo };
    const { error } = await sb.from('pdm_dados').upsert({ chave: CHAVE, valor: prefs, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
    if (error) throw error;
    return NextResponse.json({ ok: true, prefs });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar os ajustes.' }, { status: 500 });
  }
}
