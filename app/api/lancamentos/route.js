import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, usuarioDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

const TABELA = 'financas_lancamentos';

function usuarioLogado() {
  const valor = cookies().get(nomeCookie())?.value;
  return usuarioDaSessao(valor);
}

// Lista todos os lançamentos (compartilhados entre os dois usuários).
// Aceita ?mes=YYYY-MM para filtrar por mês.
export async function GET(request) {
  if (!usuarioLogado()) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes');
    const sb = supabaseServer();
    let q = sb.from(TABELA).select('*').order('data', { ascending: false }).order('criado_em', { ascending: false });
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      q = q.gte('data', `${mes}-01`).lte('data', `${mes}-31`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ ok: true, lancamentos: data || [] });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e?.message || 'Erro ao carregar lançamentos.' },
      { status: 500 }
    );
  }
}

// Cria um lançamento. O nome de quem lançou vem SEMPRE do usuário logado
// (do cookie), nunca do corpo da requisição — assim não dá pra forjar.
export async function POST(request) {
  const usuario = usuarioLogado();
  if (!usuario) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 });
  }

  const tipo = body?.tipo === 'receita' ? 'receita' : 'despesa';
  const valor = Number(body?.valor);
  if (!(valor > 0)) {
    return NextResponse.json({ ok: false, erro: 'Informe um valor maior que zero.' }, { status: 400 });
  }
  const data = /^\d{4}-\d{2}-\d{2}$/.test(body?.data) ? body.data : null;
  if (!data) {
    return NextResponse.json({ ok: false, erro: 'Data inválida.' }, { status: 400 });
  }
  const categoria = String(body?.categoria || '').slice(0, 80) || 'Outros';
  const descricao = String(body?.descricao || '').slice(0, 300);

  try {
    const sb = supabaseServer();
    const { data: inserido, error } = await sb
      .from(TABELA)
      .insert({ tipo, valor, categoria, descricao, data, usuario: usuario.nome })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, lancamento: inserido });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e?.message || 'Erro ao salvar lançamento.' },
      { status: 500 }
    );
  }
}

// Apaga um lançamento por id. Como o controle é do casal, qualquer um dos dois
// pode apagar qualquer lançamento compartilhado.
export async function DELETE(request) {
  if (!usuarioLogado()) {
    return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ ok: false, erro: 'Id não informado.' }, { status: 400 });
    }
    const sb = supabaseServer();
    const { error } = await sb.from(TABELA).delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, erro: e?.message || 'Erro ao apagar lançamento.' },
      { status: 500 }
    );
  }
}
