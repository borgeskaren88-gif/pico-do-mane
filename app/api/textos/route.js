import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// A pasta de textos do bar: modelo de cobrança, ficha técnica de prato e de
// drink, receita, roteiro de atendimento — tudo que hoje vive espalhado no
// bloco de notas do celular de alguém e some quando esse alguém não está.
//
// Cada texto guarda em que pasta ele está, e a pasta é só um nome livre: quem
// escreve decide como organizar. Uma linha por texto (texto:<id>), pra duas
// pessoas escrevendo ao mesmo tempo nunca apagarem o trabalho uma da outra.
const PREFIXO = 'texto:';

const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const papel = () => papelDaSessao(cookies().get(nomeCookie())?.value);
const podeVer = (p) => p === 'reservas' || p === 'dona';

export async function GET() {
  if (!podeVer(papel())) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', PREFIXO + '%');
    if (error) throw error;
    const textos = (data || [])
      .map((r) => r.valor)
      .filter((t) => t && t.id)
      .sort((a, b) => String(b.atualizadoEm || '').localeCompare(String(a.atualizadoEm || '')));
    return NextResponse.json({ ok: true, textos });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar a pasta.' }, { status: 500 });
  }
}

export async function POST(request) {
  const p = papel();
  if (!podeVer(p)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = txt(body?.acao, 20);

  try {
    const sb = supabaseServer();

    if (acao === 'excluir') {
      const id = txt(body?.id, 40);
      if (!id) return NextResponse.json({ ok: false, erro: 'Texto não informado.' }, { status: 400 });
      const { error } = await sb.from('pdm_dados').delete().eq('chave', PREFIXO + id);
      if (error) throw error;
      return NextResponse.json({ ok: true, excluido: true });
    }

    const id = txt(body?.id, 40) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const titulo = txt(body?.titulo, 120);
    const pasta = txt(body?.pasta, 60) || 'Sem pasta';
    const corpo = String(body?.texto == null ? '' : body.texto).slice(0, 20000);
    if (!titulo) return NextResponse.json({ ok: false, erro: 'Dá um nome pro texto.' }, { status: 400 });

    const { data: antes } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id).maybeSingle();
    const registro = {
      id, titulo, pasta, texto: corpo,
      criadoPor: antes?.valor?.criadoPor || p,
      criadoEm: antes?.valor?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    const { error } = await sb.from('pdm_dados').upsert(
      { chave: PREFIXO + id, valor: registro, atualizado_em: new Date().toISOString() },
      { onConflict: 'chave' },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, texto: registro });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar o texto.' }, { status: 500 });
  }
}
