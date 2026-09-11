import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { supabaseServer } from '../../../lib/supabase';
import { notificarReservaNova } from '../../../lib/push';
import { criarEvento, atualizarEvento, apagarEvento } from '../../../lib/google';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // o aviso usa web-push, que precisa do Node.

// Mesas reservadas. Quem anota é a pessoa das reservas (ou a dona), mas TODO
// mundo lê: a cozinha precisa saber que às 20h chegam 10 pessoas, o
// atendimento precisa guardar a mesa. Por isso a leitura é livre pra quem está
// logado e só a escrita é fechada.
const PREFIXO = 'reserva:';

// Como a reserva aparece na agenda: "Reserva: Ana Paula · 8 pessoas".
const tituloDaAgenda = (r) => {
  const q = Number(r.pessoas) || 1;
  return `Reserva: ${r.nome} · ${q} ${q === 1 ? 'pessoa' : 'pessoas'}`;
};

const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const ehHora = (s) => /^\d{2}:\d{2}$/.test(String(s || ''));

const papel = () => papelDaSessao(cookies().get(nomeCookie())?.value);
const podeEscrever = (p) => p === 'reservas' || p === 'dona';

export async function GET() {
  if (!papel()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = supabaseServer();
    const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', PREFIXO + '%');
    if (error) throw error;
    const reservas = (data || [])
      .map((r) => r.valor)
      .filter((r) => r && r.data)
      .sort((a, b) => `${a.data} ${a.hora || ''}`.localeCompare(`${b.data} ${b.hora || ''}`));
    return NextResponse.json({ ok: true, reservas });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar as reservas.' }, { status: 500 });
  }
}

export async function POST(request) {
  const p = papel();
  if (!podeEscrever(p)) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const acao = txt(body?.acao, 20);

  try {
    const sb = supabaseServer();

    if (acao === 'excluir') {
      const id = txt(body?.id, 40);
      if (!id) return NextResponse.json({ ok: false, erro: 'Reserva não informada.' }, { status: 400 });
      // Tira também do Google Agenda, senão ficava lá uma mesa que não existe.
      const { data: antiga } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id).maybeSingle();
      const gid = antiga?.valor?.googleId;
      if (gid) { try { await apagarEvento(gid); } catch { /* sem Google: a reserva some do PicoOS do mesmo jeito */ } }
      const { error } = await sb.from('pdm_dados').delete().eq('chave', PREFIXO + id);
      if (error) throw error;
      return NextResponse.json({ ok: true, excluida: true });
    }

    // Salvar (nova ou editada). Editar não dispara aviso de novo — só a criação,
    // senão todo ajuste de vírgula tocaria o celular de todo mundo.
    const id = txt(body?.id, 40) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const nome = txt(body?.nome, 60);
    const data = txt(body?.data, 10);
    const hora = txt(body?.hora, 5);
    const pessoas = Math.max(1, Math.min(999, Math.round(Number(body?.pessoas) || 0) || 1));
    const obs = txt(body?.obs, 400);
    const telefone = txt(body?.telefone, 30);
    if (!nome) return NextResponse.json({ ok: false, erro: 'Diz o nome de quem reservou.' }, { status: 400 });
    if (!ehData(data)) return NextResponse.json({ ok: false, erro: 'Escolhe o dia da reserva.' }, { status: 400 });
    if (hora && !ehHora(hora)) return NextResponse.json({ ok: false, erro: 'Hora inválida.' }, { status: 400 });

    const { data: antes } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id).maybeSingle();
    const nova = !antes?.valor;
    const reserva = {
      id, nome, data, hora, pessoas, obs, telefone,
      googleId: antes?.valor?.googleId || '',
      criadoPor: antes?.valor?.criadoPor || p,
      criadoEm: antes?.valor?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    // A reserva também vira compromisso no Google Agenda: assim ela aparece no
    // calendário do celular de quem usa a agenda e ainda dispara o aviso 15 min
    // antes que o PicoOS já fazia pros compromissos. Se o Google não estiver
    // conectado, nada disso acontece e a reserva é salva igual.
    const naAgenda = { titulo: tituloDaAgenda(reserva), data, hora, diaTodo: !hora };
    try {
      if (reserva.googleId) {
        await atualizarEvento(reserva.googleId, naAgenda);
      } else {
        const ev = await criarEvento(naAgenda);
        if (ev && ev.id) reserva.googleId = ev.id;
      }
    } catch { /* Google fora do ar ou não conectado: segue sem ele */ }
    const { error } = await sb.from('pdm_dados').upsert(
      { chave: PREFIXO + id, valor: reserva, atualizado_em: new Date().toISOString() },
      { onConflict: 'chave' },
    );
    if (error) throw error;

    // Todo mundo fica sabendo na hora: dona, cozinha e atendimento.
    let avisou = null;
    if (nova) { try { avisou = await notificarReservaNova(sb, reserva); } catch { /* aviso é bônus, nunca derruba o salvamento */ } }

    return NextResponse.json({ ok: true, reserva, nova, avisou });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao salvar a reserva.' }, { status: 500 });
  }
}
