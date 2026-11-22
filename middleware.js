import { NextResponse } from 'next/server';
import { situacao } from './lib/assinatura';

// O PORTEIRO: confere se o crachá ainda vale, antes de qualquer tela ou pedido.
//
// "Demiti a pessoa da cozinha. Como bloqueio o acesso dela?"
//
// O crachá de cada acesso carrega a GERAÇÃO com que foi emitido (ver
// lib/auth.js). Saber se ele é VERDADEIRO é conta de segredo. Saber se ele
// ainda ESTÁ VALENDO precisa olhar o banco — e espalhar essa consulta pelas
// trinta e poucas rotas do app seria trinta e poucas chances de esquecer uma.
//
// Então mora aqui, uma vez só, na frente de tudo.
//
// Duas economias importantes, porque isto roda em TODO pedido:
//   1. a geração de cada acesso fica guardada meio minuto na memória;
//   2. enquanto ninguém nunca cortou nada (todas as gerações em 1), não há o
//      que vencer — o porteiro devolve na hora, sem contar nem calcular nada.

const CHAVE = 'acessosGeracoes';
const VALIDADE_CACHE = 30 * 1000;
const PAPEIS = [
  ['cozinha', 'pico-do-mane-cozinha:'],
  ['garcom', 'pico-do-mane-garcom:'],
  ['reservas', 'pico-do-mane-reservas:'],
  // O extra tem geração própria: fechar o acesso dele não derruba o atendimento.
  ['extra', 'pico-do-mane-extra:'],
  ['gerente', 'pico-do-mane-gerente:'],
];

// Um cache e uma "última boa" POR NEGÓCIO. Num app de muitos, as gerações de
// um cliente não têm nada a ver com as do outro: se fosse uma lista só, cortar
// a cozinha de um bar derrubaria a cozinha de todos os outros na mesma hora.
const cache = new Map();      // negocio -> { geracoes, em }
const ultimaBoa = new Map();  // negocio -> geracoes (sobrevive a soluço do banco)

async function geracoes(negocio) {
  const agora = Date.now();
  const guardado = cache.get(negocio);
  if (guardado && agora - guardado.em < VALIDADE_CACHE) return guardado.geracoes;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return ultimaBoa.get(negocio) || null;

  // A linha das gerações mora dentro do negócio, com a marca dele — a mesma que
  // lib/banco.js põe. Instalação de um cliente só não tem marca nenhuma.
  const chave = (negocio ? `n:${negocio}:` : '') + CHAVE;
  try {
    const r = await fetch(`${url}/rest/v1/pdm_dados?select=valor&chave=eq.${encodeURIComponent(chave)}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!r.ok) return ultimaBoa.get(negocio) || null;
    const linhas = await r.json();
    const v = (Array.isArray(linhas) && linhas[0] && linhas[0].valor) || {};
    const out = {};
    for (const [p] of PAPEIS) {
      const n = Math.floor(Number(v[p]));
      out[p] = Number.isFinite(n) && n >= 1 ? n : 1;
    }
    cache.set(negocio, { geracoes: out, em: agora });
    ultimaBoa.set(negocio, out);
    return out;
  } catch {
    // Banco engasgou. Vale a última leitura boa; se nunca houve uma, deixa
    // passar — derrubar a cozinha inteira por causa de um soluço de rede seria
    // trocar um problema raro por um problema toda noite.
    return ultimaBoa.get(negocio) || null;
  }
}

// A PORTA DA ASSINATURA: o bar que passou do teste (ou da carência) sem pagar
// não usa o app — nem quem já estava logado no celular há semanas. Suspenso
// pela Karen, idem. A tela (app/page.js) mostra o porquê; aqui o porteiro só
// recusa os pedidos de dados.
//
// Lê a lista de negócios (uma linha só) e guarda um minuto na memória. Se o
// banco engasgar, deixa passar: um soluço de rede não pode trancar um bar que
// está pago — muito menos o Pico do Mané, que nem tem assinatura (é isento).
const cacheLista = { lista: null, em: 0 };
async function listaDeNegocios() {
  const agora = Date.now();
  // LISTA_CACHE_MS existe só pro laboratório (que precisa ver a porta fechar na
  // hora); em produção fica o minuto.
  const validade = process.env.LISTA_CACHE_MS != null && process.env.LISTA_CACHE_MS !== '' ? Number(process.env.LISTA_CACHE_MS) : 60 * 1000;
  if (cacheLista.lista && agora - cacheLista.em < validade) return cacheLista.lista;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return cacheLista.lista;
  try {
    const r = await fetch(`${url}/rest/v1/pdm_dados?select=valor&chave=eq.${encodeURIComponent('adm:negocios')}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!r.ok) return cacheLista.lista;
    const linhas = await r.json();
    const v = (Array.isArray(linhas) && linhas[0] && linhas[0].valor) || {};
    cacheLista.lista = v;
    cacheLista.em = agora;
    return v;
  } catch {
    return cacheLista.lista;
  }
}
// O que continua respondendo com o app pausado: sair, ver/pagar a assinatura
// e as rotas da tela de entrada.
const LIVRES = ['/api/assinatura', '/api/logout', '/api/login', '/api/negocio', '/api/versao', '/api/sessao', '/api/cadastro'];

// sha256 em hexadecimal, com o que existe no runtime do porteiro (o mesmo
// resultado do crypto do Node, que é quem emite os crachás).
async function sha256hex(txt) {
  const bytes = new TextEncoder().encode(txt);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req) {
  const cookie = req.cookies.get('pdm_session')?.value;
  if (!cookie) return NextResponse.next();

  // O crachá do app único vem como "negocio|...". O porteiro precisa separar
  // isso ANTES de qualquer coisa: o nome do negócio diz de quem são as gerações
  // a consultar E entra na conta que confere o crachá. Sem isso, nenhum crachá
  // de cliente bateria aqui, o porteiro deixaria todos passarem, e
  // "desconectar os aparelhos da cozinha" pararia de funcionar justamente pra
  // quem paga.
  const barra = cookie.indexOf('|');
  // DOIS nomes, e eles podem ser diferentes:
  //   - o do CRACHÁ é o que entrou na conta que o gerou. Crachá de instalação
  //     de um cliente não tem nome nenhum, e a conta dele é a antiga.
  //   - o dos DADOS é onde mora a linha das gerações. Numa instalação que já
  //     mudou de casa, é o NEGOCIO_UNICO — mesmo que o crachá não tenha nome.
  // Confundir os dois quebra uma das duas coisas, calado.
  const doCracha = barra < 0 ? '' : cookie.slice(0, barra);
  const dosDados = doCracha || String(process.env.NEGOCIO_UNICO || '').trim().toLowerCase();
  const semNegocio = barra < 0 ? cookie : cookie.slice(barra + 1);

  if (doCracha && req.nextUrl.pathname.startsWith('/api/') && !LIVRES.some((l) => req.nextUrl.pathname === l || req.nextUrl.pathname.startsWith(l + '/'))) {
    const lista = await listaDeNegocios();
    // Só fecha com a lista lida E o bar nela. Bar que não está na lista não é
    // assunto daqui (o login e o crachá cuidam).
    if (lista && lista[doCracha]) {
      const s = situacao({ codigo: doCracha, ...lista[doCracha] });
      if (!s.podeUsar) {
        return NextResponse.json({
          ok: false, pausado: s.estado,
          erro: s.estado === 'suspenso' ? 'O acesso deste bar está pausado.' : 'O teste ou a mensalidade venceu. A dona precisa pagar pra liberar.',
        }, { status: 402 });
      }
    }
  }

  const atuais = await geracoes(dosDados);
  // Sem leitura ou com tudo na geração 1: nada foi cortado, nada pode estar
  // vencido. Sai daqui sem gastar uma conta sequer.
  if (!atuais || PAPEIS.every(([p]) => atuais[p] === 1)) return NextResponse.next();

  // A geração vem escrita no crachá; crachá antigo, de antes disto existir, é
  // geração 1 — que é justamente o caso do aparelho de quem já estava logado.
  const m = /^g(\d{1,6})\.(.+)$/.exec(semNegocio);
  const geracao = m ? Math.max(1, Number(m[1])) : 1;

  // De qual acesso é este crachá? O porteiro descobre refazendo a conta. O
  // cookie da DONA não bate com nenhum dos três — e aí ele passa direto, que é
  // como tem que ser: o acesso dela não se corta por aqui.
  const segredo = process.env.SESSION_SECRET || '';
  const tempero = (geracao > 1 ? ':g' + geracao : '') + (doCracha ? ':n:' + doCracha : '');
  for (const [papel, prefixo] of PAPEIS) {
    const esperado = await sha256hex(prefixo + segredo + tempero);
    const valor = m ? m[2] : semNegocio;
    if (valor !== esperado) continue;
    // É deste acesso. Vale enquanto for da geração em vigor.
    if (geracao >= atuais[papel]) return NextResponse.next();

    // Crachá de geração aposentada: cai fora. O cookie some e a pessoa volta
    // pra tela de senha — sem mensagem técnica, só o login de novo.
    const ehApi = req.nextUrl.pathname.startsWith('/api/');
    const resposta = ehApi
      ? NextResponse.json({ ok: false, erro: 'Acesso encerrado. Entre de novo.' }, { status: 401 })
      : NextResponse.redirect(new URL('/', req.url));
    resposta.cookies.set('pdm_session', '', { path: '/', maxAge: 0 });
    return resposta;
  }

  return NextResponse.next();
}

export const config = {
  // Fora os arquivos do próprio app: eles não têm dono, e conferir cada um
  // seria pagar uma conta pra entregar um ícone.
  matcher: ['/((?!_next/static|_next/image|favicon|icons|sw\\.js|manifest\\.webmanifest|apple-touch-icon).*)'],
};
