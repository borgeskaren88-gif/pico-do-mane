import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { bancoDaSessao } from '../../../lib/negocioAtual';
import { enviarPush } from '../../../lib/push';

export const dynamic = 'force-dynamic';

// "O PEDIDO ESTÁ PRONTO" — SEM GRITAR.
//
// "Tem como de alguma forma todos os login poder afirmar que o pedido está
// pronto, não somente o da cozinha, pois às vezes estou na cozinha também ou o
// atendimento também... hoje aqui ficamos gritando."
//
// Por que esta rota existe em vez de uma ação em /api/comandas: a cozinha NÃO
// pode falar com a de comandas, de propósito — ela não vê valores do bar. Mas
// é justamente a cozinha que termina o prato. Então a porta é esta, e por ela
// passa só NÚMERO DE MESA. Nenhum preço, nenhuma conta, nenhum nome de cliente.
//
// Quem aperta pode ser qualquer um dos três, porque no bar dela os papéis se
// misturam: ela cozinha, o atendimento entra na cozinha. Quem termina o prato é
// quem está com a mão nele, não quem está com o crachá certo.

const PREFIXO_COMANDA = 'comanda:';
const CHAVE = 'prontos';

// Um aviso vale duas horas. Depois disso ou alguém pegou o prato, ou o problema
// não é mais notificação. Guardar mais que isso só faria a lista crescer sem
// ninguém ler — e cada leitura dela é egresso que ela paga.
const VALIDADE_MS = 2 * 60 * 60 * 1000;
const MAX = 20;

function papel() {
  const p = papelDaSessao(cookies().get(nomeCookie())?.value);
  return p === 'dona' || p === 'cozinha' || p === 'garcom' ? p : null;
}

const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

async function lerProntos(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE).maybeSingle();
  const lista = Array.isArray(data?.valor) ? data.valor : [];
  const corte = Date.now() - VALIDADE_MS;
  return lista.filter((x) => x && x.ts > corte);
}

export async function GET() {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  try {
    const sb = bancoDaSessao();

    // As mesas abertas, SÓ O NÚMERO. É o que a cozinha precisa pra escolher, e
    // é tudo que ela pode ver daqui.
    const { data } = await sb.from('pdm_dados').select('valor').like('chave', PREFIXO_COMANDA + '%');
    const mesas = (data || [])
      .map((r) => r.valor)
      .filter((c) => c && c.status === 'aberta' && c.mesa)
      .map((c) => String(c.mesa))
      .sort((a, b) => Number(a) - Number(b));

    return NextResponse.json({ ok: true, papel: p, mesas, prontos: await lerProntos(sb) });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro.' }, { status: 500 });
  }
}

export async function POST(request) {
  const p = papel();
  if (!p) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }

  const sb = bancoDaSessao();
  const acao = txt(body?.acao, 20);

  // Peguei o prato: tira o aviso da tela de todo mundo. Sem isso o banner fica
  // piscando depois de resolvido, e aviso que fica depois de resolvido é aviso
  // que se aprende a ignorar.
  if (acao === 'peguei') {
    const id = txt(body?.id, 40);
    const lista = (await lerProntos(sb)).filter((x) => x.id !== id);
    await sb.from('pdm_dados').upsert({ chave: CHAVE, valor: lista, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
    return NextResponse.json({ ok: true, prontos: lista });
  }

  const mesa = txt(body?.mesa, 20);
  if (!mesa) return NextResponse.json({ ok: false, erro: 'Diz qual mesa.' }, { status: 400 });

  // Mesma mesa apertada duas vezes em menos de um minuto é o dedo, não dois
  // pratos. Guardar os dois faria o celular de todo mundo tocar em dobro.
  const antes = await lerProntos(sb);
  const agora = Date.now();
  const repetido = antes.find((x) => x.mesa === mesa && agora - x.ts < 60 * 1000);
  if (repetido) return NextResponse.json({ ok: true, repetido: true, prontos: antes });

  const evento = { id: uid(), mesa, por: p, ts: agora };
  const lista = [evento, ...antes].slice(0, MAX);
  const { error } = await sb.from('pdm_dados').upsert(
    { chave: CHAVE, valor: lista, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' }
  );
  if (error) throw error;

  // O push vai pra TODOS os papéis: no bar dela quem busca o prato é quem está
  // com a mão livre, não um cargo.
  //
  // Menos pra quem apertou — o celular de quem acabou de apertar o botão não
  // precisa avisar que o botão foi apertado. O aparelho manda a própria
  // inscrição pra ser deixada de fora.
  let enviados = 0;
  try {
    const r = await enviarPush(sb, {
      titulo: `🍽️ Mesa ${mesa} pronta`,
      corpo: 'O pedido saiu da cozinha.',
      url: '/', tag: 'pronto-' + evento.id, audiencia: 'todos',
      excluirChave: txt(body?.excluir, 200) || '',
    });
    enviados = r?.enviados || 0;
  } catch (e) { /* o aviso na tela não depende do push */ }

  // Devolve quantos celulares receberam. A tela usa isso pra ser honesta: se
  // não chegou em ninguém, ela diz, em vez de deixar a pessoa confiar num
  // aviso que não saiu.
  return NextResponse.json({ ok: true, evento, prontos: lista, enviados });
}
