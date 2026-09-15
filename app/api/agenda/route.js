import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { criarEvento, atualizarEvento, apagarEvento } from '../../../lib/google';

export const dynamic = 'force-dynamic';

// Os compromissos da agenda da Karen, guardados no PicoOS.
//
// Antes o "+ Novo compromisso" escrevia direto no Google Agenda — e quando a
// conexão com o Google caía (ou o token vencia), marcar na agenda simplesmente
// não ia: o compromisso não era salvo em lugar nenhum. Agora é o contrário: o
// compromisso é sempre salvo aqui, e o Google é bônus — se estiver conectado,
// o mesmo compromisso também vai pro celular dela.
const PREFIXO = 'compromisso:';

const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const ehHora = (s) => /^\d{2}:\d{2}$/.test(String(s || ''));

const papel = () => papelDaSessao(cookies().get(nomeCookie())?.value);

export async function GET() {
  if (papel() !== 'dona') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', PREFIXO + '%');
    if (error) throw error;
    const compromissos = (data || [])
      .map((r) => r.valor)
      .filter((c) => c && c.data)
      .sort((a, b) => `${a.data} ${a.hora || ''}`.localeCompare(`${b.data} ${b.hora || ''}`));
    return NextResponse.json({ ok: true, compromissos });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar a agenda.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (papel() !== 'dona') return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = txt(body?.acao, 20);

  try {
    const sb = supabaseServer();

    if (acao === 'excluir') {
      const id = txt(body?.id, 40);
      if (!id) return NextResponse.json({ ok: false, erro: 'Compromisso não informado.' }, { status: 400 });
      const { data: antigo } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id).maybeSingle();
      const gid = antigo?.valor?.googleId;
      if (gid) { try { await apagarEvento(gid); } catch { /* sem Google: some do PicoOS do mesmo jeito */ } }
      const { error } = await sb.from('pdm_dados').delete().eq('chave', PREFIXO + id);
      if (error) throw error;
      return NextResponse.json({ ok: true, excluido: true });
    }

    // Riscar/desriscar. Mexe só nesse campo — não esbarra no resto.
    if (acao === 'concluir') {
      const id = txt(body?.id, 40);
      if (!id) return NextResponse.json({ ok: false, erro: 'Compromisso não informado.' }, { status: 400 });
      const { data: atual } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id).maybeSingle();
      if (!atual?.valor) return NextResponse.json({ ok: false, erro: 'Compromisso não encontrado.' }, { status: 404 });
      const compromisso = { ...atual.valor, concluida: body?.concluida !== false, atualizadoEm: new Date().toISOString() };
      const { error } = await sb.from('pdm_dados').upsert(
        { chave: PREFIXO + id, valor: compromisso, atualizado_em: new Date().toISOString() },
        { onConflict: 'chave' },
      );
      if (error) throw error;
      return NextResponse.json({ ok: true, compromisso });
    }

    const id = txt(body?.id, 40) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const titulo = txt(body?.titulo, 200);
    const data = txt(body?.data, 10);
    const diaTodo = !!body?.diaTodo;
    const hora = diaTodo ? '' : txt(body?.hora, 5);
    if (!titulo) return NextResponse.json({ ok: false, erro: 'Escreve o que é o compromisso.' }, { status: 400 });
    if (!ehData(data)) return NextResponse.json({ ok: false, erro: 'Escolhe o dia do compromisso.' }, { status: 400 });
    if (hora && !ehHora(hora)) return NextResponse.json({ ok: false, erro: 'Hora inválida.' }, { status: 400 });

    const { data: antes } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id).maybeSingle();
    const compromisso = {
      id, titulo, data, hora, diaTodo,
      googleId: antes?.valor?.googleId || '',
      concluida: !!antes?.valor?.concluida,
      criadoEm: antes?.valor?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    // O Google é bônus: se der errado (não conectado, token vencido, fora do
    // ar), o compromisso é salvo aqui do mesmo jeito. `noGoogle` volta pra tela
    // só pra avisar que dessa vez não foi pro celular.
    const naAgenda = { titulo, data, hora, diaTodo: diaTodo || !hora };
    let noGoogle = false;
    try {
      if (compromisso.googleId) {
        await atualizarEvento(compromisso.googleId, naAgenda);
      } else {
        const ev = await criarEvento(naAgenda);
        if (ev && ev.id) compromisso.googleId = ev.id;
      }
      noGoogle = true;
    } catch { /* segue sem o Google */ }

    const { error } = await sb.from('pdm_dados').upsert(
      { chave: PREFIXO + id, valor: compromisso, atualizado_em: new Date().toISOString() },
      { onConflict: 'chave' },
    );
    if (error) throw error;

    return NextResponse.json({ ok: true, compromisso, noGoogle });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar o compromisso.' }, { status: 500 });
  }
}
