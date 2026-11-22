import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookieAdmin, ehAdmin, consoleLigado } from '../../../../lib/auth';
import { lerNegocios, lerNegocio, criarNegocio, mudarNegocio, lerConfigVenda, gravarConfigVenda } from '../../../../lib/negocios';
import { situacao, assinaturaNova } from '../../../../lib/assinatura';
import { bancoDo, nomeDeNegocioValido } from '../../../../lib/banco';
import { definirSenhaDona } from '../../../../lib/senha';

export const dynamic = 'force-dynamic';

const autorizado = () => consoleLigado() && ehAdmin(cookies().get(nomeCookieAdmin())?.value);
const fora = () => NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });

// Quando cada negócio mexeu no app pela última vez. Serve pra ela ver quem
// parou de usar antes de o cliente sumir sem avisar.
//
// Lê SÓ a data da linha do painel — nunca o conteúdo. Com dez negócios isso é
// dez leituras de uma data cada; ler o painel inteiro de dez clientes pra
// montar uma lista seria pagar caro por nada (e foi exatamente esse tipo de
// leitura que estourou a conta do Supabase antes).
async function ultimoMovimento(codigo) {
  try {
    const { data } = await bancoDo(codigo).from('pdm_dados')
      .select('atualizado_em').eq('chave', 'painel').maybeSingle();
    return data?.atualizado_em || null;
  } catch { return null; }
}

export async function GET() {
  if (!autorizado()) return fora();
  const todos = await lerNegocios();
  const codigos = Object.keys(todos).sort();
  const negocios = await Promise.all(codigos.map(async (codigo) => ({
    codigo,
    nome: todos[codigo]?.nome || codigo,
    ativo: todos[codigo]?.ativo !== false,
    criadoEm: todos[codigo]?.criadoEm || null,
    ultimoMovimento: await ultimoMovimento(codigo),
    // A assinatura e o contato de quem se cadastrou sozinho. Os ids do Asaas
    // não saem daqui: ela não precisa deles na tela.
    situacao: situacao({ codigo, ...todos[codigo] }),
    cancelada: !!(todos[codigo]?.assinatura?.cancelada),
    assinou: !!(todos[codigo]?.assinatura?.asaasAssinatura),
    origem: todos[codigo]?.assinatura?.origem || 'manual',
    contato: todos[codigo]?.contato || null,
  })));
  const config = await lerConfigVenda().catch(() => ({ preco: 99.9, cadastroAberto: true }));
  return NextResponse.json({ ok: true, negocios, config });
}

export async function POST(request) {
  if (!autorizado()) return fora();

  let body = {};
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 }); }

  const acao = String(body?.acao || '');
  const codigo = String(body?.codigo || '').trim().toLowerCase();

  try {
    // O PREÇO E A PORTA DO CADASTRO: valem pra quem assinar DAQUI PRA FRENTE.
    // Quem já assinou continua no preço que assinou (o Asaas guarda o valor).
    if (acao === 'config') {
      const config = await gravarConfigVenda({ preco: body?.preco, cadastroAberto: body?.cadastroAberto });
      return NextResponse.json({ ok: true, config });
    }

    // CRIAR: é isto que "vender um sistema" passa a ser. Põe o negócio na lista
    // e guarda a senha da dona dentro do negócio — o app dele nasce vazio e a
    // tela de boas-vindas cuida do resto.
    if (acao === 'criar') {
      const senha = String(body?.senha || '');
      if (senha.length < 6) {
        return NextResponse.json({ ok: false, erro: 'A senha da dona precisa de pelo menos 6 letras.' }, { status: 400 });
      }
      const criado = await criarNegocio({ codigo, nome: body?.nome });
      await definirSenhaDona(bancoDo(codigo), senha);
      return NextResponse.json({ ok: true, negocio: criado });
    }

    if (!nomeDeNegocioValido(codigo) || !(await lerNegocio(codigo))) {
      return NextResponse.json({ ok: false, erro: 'Negócio não encontrado.' }, { status: 404 });
    }

    // SUSPENDER: fecha a porta e NÃO toca em nada que está guardado. É o que ela
    // usa quando alguém para de pagar — e o que permite religar no dia seguinte
    // com tudo no lugar, se a pessoa voltar.
    if (acao === 'suspender' || acao === 'religar') {
      const n = await mudarNegocio(codigo, { ativo: acao === 'religar' });
      return NextResponse.json({ ok: true, negocio: n });
    }

    // ISENTAR: o bar não paga (amigo, parceiro, o próprio Pico). COBRAR: volta
    // a contar — com 14 dias de teste a partir de hoje, se nunca pagou.
    if (acao === 'isentar' || acao === 'cobrar') {
      // O bar da casa nunca entra na cobrança, nem por um toque errado aqui.
      if (acao === 'cobrar' && codigo === String(process.env.NEGOCIO_UNICO || '').trim().toLowerCase()) {
        return NextResponse.json({ ok: false, erro: 'Este é o bar da casa: não entra na cobrança.' }, { status: 400 });
      }
      const n = await mudarNegocio(codigo, {
        assinatura: (atual) => (acao === 'isentar'
          ? { ...(atual || {}), plano: 'isento' }
          : (atual && (atual.testeAte || atual.pagoAte))
            ? { ...atual, plano: atual.pagoAte ? 'pago' : 'teste' }
            : { ...(atual || {}), ...assinaturaNova(), origem: (atual && atual.origem) || 'manual' }),
      });
      return NextResponse.json({ ok: true, negocio: n });
    }

    // MAIS DIAS: "o cliente pediu mais uma semana pra testar" ou "pagou por
    // fora, no Pix direto pra mim". Empurra a data de liberado.
    if (acao === 'maisDias') {
      const dias = Math.floor(Number(body?.dias));
      if (!(dias >= 1 && dias <= 400)) return NextResponse.json({ ok: false, erro: 'Escolhe de 1 a 400 dias.' }, { status: 400 });
      const n = await mudarNegocio(codigo, {
        assinatura: (atual) => {
          const a = { ...assinaturaNova(), ...(atual || {}) };
          const base = Math.max(Date.parse(a.testeAte || '') || 0, Date.parse(a.pagoAte || '') || 0, Date.now());
          const novo = new Date(base + dias * 86400000).toISOString();
          return a.pagoAte ? { ...a, pagoAte: novo } : { ...a, testeAte: novo };
        },
      });
      return NextResponse.json({ ok: true, negocio: n });
    }

    if (acao === 'renomear') {
      const n = await mudarNegocio(codigo, { nome: String(body?.nome || '') });
      return NextResponse.json({ ok: true, negocio: n });
    }

    // TROCAR A SENHA DA DONA: pra quando o cliente perder a dele. Ela põe uma
    // nova e manda; o cliente troca depois, dentro do app.
    if (acao === 'senha') {
      const senha = String(body?.senha || '');
      if (senha.length < 6) {
        return NextResponse.json({ ok: false, erro: 'A senha precisa de pelo menos 6 letras.' }, { status: 400 });
      }
      await definirSenhaDona(bancoDo(codigo), senha);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, erro: 'Ação desconhecida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Não deu certo.' }, { status: 400 });
  }
}
