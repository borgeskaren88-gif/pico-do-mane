import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, opcoesDoCracha, valorSessaoValida, valorSessaoCozinha, valorSessaoGarcom, valorSessaoReservas } from '../../../lib/auth';
import { bancoDaSessao } from '../../../lib/negocioAtual';
import { conferirSenhaDona, temSenhaDona, conferirSenhaPapel } from '../../../lib/senha';
import { lerGeracoes } from '../../../lib/acessos';
import { bancoDoNegocioAtivo, lerNegocios } from '../../../lib/negocios';
import { nomeDeNegocioValido } from '../../../lib/banco';

export const dynamic = 'force-dynamic';

function comparaSegura(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(request) {
  let senha = '';
  let papelPedido = '';
  let codigo = '';
  // "lembrar": o celular manda true (fica logado). No computador vem false, e aí
  // o cookie é "de sessão" — some quando fecha o navegador, então pede a senha
  // de novo na próxima vez. Assim o computador não fica aberto pra qualquer um.
  let lembrar = false;
  try {
    const body = await request.json();
    senha = body?.senha ?? '';
    papelPedido = body?.papel ?? '';
    lembrar = body?.lembrar === true;
    codigo = String(body?.codigo ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, erro: 'Requisição inválida.' }, { status: 400 });
  }

  // DOIS JEITOS DE ENTRAR, E SÓ UM VALE POR INSTALAÇÃO.
  //
  // Sem código: a instalação de um cliente só, como está hoje. A senha da dona
  // vem da APP_PASSWORD (ou do banco, se ela trocou no app), e o crachá sai sem
  // nome de negócio — exatamente o mesmo de antes, ninguém é deslogado.
  //
  // Com código: o app de muitos. O código diz de que negócio é a senha, e o
  // crachá sai carimbado com ele. Senha certa do negócio errado não entra, e
  // negócio suspenso não entra de jeito nenhum.
  //
  // A resposta é a MESMA ("Código ou senha incorretos") para código que não
  // existe, negócio suspenso e senha errada. Senão a tela de entrada vira uma
  // lista de quem são os clientes da Karen, pra qualquer um na internet.
  const recusa = () => NextResponse.json(
    { ok: false, erro: codigo ? 'Código ou senha incorretos.' : 'Senha incorreta.' },
    { status: 401 },
  );

  let sb = null;
  let negocio = '';
  if (codigo) {
    if (!nomeDeNegocioValido(codigo)) return recusa();
    const banco = await bancoDoNegocioAtivo(codigo);
    if (!banco) return recusa();
    sb = banco;
    negocio = codigo;
  } else {
    // Sem código, o banco é o da instalação (NEGOCIO_UNICO). Isto PRECISA ser o
    // mesmo banco que as outras rotas usam: se o login lesse as senhas de um
    // lugar e a tela de Acessos gravasse em outro, trocar a senha da cozinha
    // não teria efeito nenhum no login — e "desconectar o aparelho de quem
    // saiu" viraria um botão que não faz nada.
    try {
      sb = bancoDaSessao();
    } catch {
      // Duas situações, e a pessoa precisa saber qual é:
      //  - app de muitos: ela esqueceu de escrever o código;
      //  - instalação sem NEGOCIO_UNICO: quem configurou é que esqueceu.
      const temNegocios = Object.keys(await lerNegocios()).length > 0;
      return temNegocios
        ? NextResponse.json({ ok: false, erro: 'Escreve o código do negócio.' }, { status: 400 })
        : NextResponse.json({ ok: false, erro: 'Servidor sem NEGOCIO_UNICO configurado.' }, { status: 500 });
    }
  }

  // A senha da dona pode ter sido trocada no app (guardada no banco) ou vir da
  // APP_PASSWORD. Se não houver nenhuma das duas, aí sim é falta de config.
  // Num negócio do app único não existe APP_PASSWORD: a senha dele nasce no
  // banco quando a Karen cria o negócio, então "sem senha" ali é recusa, não
  // erro de servidor — não se conta pra fora que o negócio existe mas está sem
  // senha.
  if (!(await temSenhaDona(sb, { semEnv: !!negocio }))) {
    if (negocio) return recusa();
    return NextResponse.json(
      { ok: false, erro: 'Servidor sem senha configurada (APP_PASSWORD).' },
      { status: 500 }
    );
  }

  // A geração em vigor de cada acesso. O crachá sai carimbado com ela — é o que
  // faz "desconectar todos os aparelhos da cozinha" valer pros crachás velhos e
  // não pro que está sendo emitido agora.
  const ger = await lerGeracoes(sb);

  const op = { semEnv: !!negocio };
  let valorCookie = null;
  let papel = null;
  // Com o papel escolhido no login, cozinha e garçom podem usar a mesma senha
  // (1234) sem ambiguidade: o papel é que decide qual acesso abrir.
  if (papelPedido === 'cozinha') {
    if (senha && await conferirSenhaPapel(sb, 'cozinha', senha, op)) { valorCookie = valorSessaoCozinha(ger.cozinha, negocio); papel = 'cozinha'; }
  } else if (papelPedido === 'garcom') {
    if (senha && await conferirSenhaPapel(sb, 'garcom', senha, op)) { valorCookie = valorSessaoGarcom(ger.garcom, negocio); papel = 'garcom'; }
  } else if (papelPedido === 'reservas') {
    // A Mari pode ter trocado a senha dela dentro do app — aí vale a do banco.
    if (senha && await conferirSenhaPapel(sb, 'reservas', senha, op)) { valorCookie = valorSessaoReservas(ger.reservas, negocio); papel = 'reservas'; }
  } else if (papelPedido === 'dona' || !papelPedido) {
    // 'dona' explícito, ou sem papel (compatibilidade): tenta dona e, se não for,
    // ainda aceita cozinha pela senha (não quebra quem já usava só a senha).
    if (senha && await conferirSenhaDona(sb, senha, op)) { valorCookie = valorSessaoValida(negocio); papel = 'dona'; }
    else if (!papelPedido && senha && await conferirSenhaPapel(sb, 'cozinha', senha, op)) { valorCookie = valorSessaoCozinha(ger.cozinha, negocio); papel = 'cozinha'; }
  }

  if (!valorCookie) return recusa();

  // Celular: 90 dias. Computador: dez minutos que o app renova enquanto está
  // aberto — fechou, morre sozinho. A regra mora em opcoesDoCracha.
  cookies().set(nomeCookie(), valorCookie, opcoesDoCracha(lembrar));

  return NextResponse.json({ ok: true, papel });
}
