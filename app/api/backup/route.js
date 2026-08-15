import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

// Backup automático: guarda uma cópia do painel inteiro (DRE, estoque, fichas,
// clientes, cardápio, tarefas…) numa linha 'backup:<data>' por dia, na nuvem.
// Assim, além do salvamento normal, há um histórico pra restaurar se algo der
// errado. Mantém os últimos MAX dias. Só a dona mexe aqui.
const PAINEL = 'painel';
const PREFIXO = 'backup:';
const MAX_BACKUPS = 14;
const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function ehDona() {
  return papelDaSessao(cookies().get(nomeCookie())?.value) === 'dona';
}

const arr = (v) => (Array.isArray(v) ? v : []);
// Resumo leve (contagens) pra listar os backups sem trafegar o blob inteiro.
function resumoDe(painel) {
  const p = painel || {};
  return {
    lancamentos: arr(p.diario).length + arr(p.receitas).length + arr(p.despesas).length + arr(p.compras).length,
    estoque: arr(p.estoque).length,
    fichas: arr(p.fichas).length,
    clientes: arr(p.clientes).length,
    cardapio: arr(p.cardapio).length,
  };
}

export async function GET() {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('chave, valor').like('chave', PREFIXO + '%');
    if (error) throw error;
    const backups = (data || [])
      .map((r) => ({ data: (r.chave || '').slice(PREFIXO.length), criadoEm: r.valor?.criadoEm || '', resumo: r.valor?.resumo || resumoDe(r.valor?.painel) }))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    return NextResponse.json({ ok: true, backups });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao listar backups.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = String(body?.acao || '');
  try {
    const sb = supabaseServer();

    // Cópia do dia (chamada quando a dona abre o app). Se já existe a de hoje,
    // não refaz. Depois de gravar, poda os backups mais antigos.
    if (acao === 'auto') {
      const hoje = hojeBrasil();
      const { data: existe } = await sb.from('pdm_dados').select('chave').eq('chave', PREFIXO + hoje).maybeSingle();
      if (existe) return NextResponse.json({ ok: true, criado: false });
      const { data: painelRow } = await sb.from('pdm_dados').select('valor').eq('chave', PAINEL).maybeSingle();
      const painel = painelRow?.valor || {};
      const snap = { data: hoje, criadoEm: new Date().toISOString(), resumo: resumoDe(painel), painel };
      const { error } = await sb.from('pdm_dados').upsert({ chave: PREFIXO + hoje, valor: snap, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      // Poda: mantém só os MAX_BACKUPS mais recentes.
      const { data: todos } = await sb.from('pdm_dados').select('chave').like('chave', PREFIXO + '%');
      const chaves = (todos || []).map((r) => r.chave).sort().reverse();
      const excedentes = chaves.slice(MAX_BACKUPS);
      if (excedentes.length) await sb.from('pdm_dados').delete().in('chave', excedentes);
      return NextResponse.json({ ok: true, criado: true, data: hoje });
    }

    // Restaurar: joga o painel de um backup de volta pra linha principal. Isso
    // substitui os dados atuais pelo do dia escolhido.
    if (acao === 'restaurar') {
      const data = String(body?.data || '');
      if (!data) return NextResponse.json({ ok: false, erro: 'Backup não informado.' }, { status: 400 });
      const { data: snapRow } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + data).maybeSingle();
      const painel = snapRow?.valor?.painel;
      if (!painel) return NextResponse.json({ ok: false, erro: 'Backup não encontrado.' }, { status: 404 });
      const { error } = await sb.from('pdm_dados').upsert({ chave: PAINEL, valor: painel, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro no backup.' }, { status: 500 });
  }
}
