import { NextResponse } from 'next/server';

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
];

let cache = null;      // { geracoes, em }
let ultimaBoa = null;  // última leitura que deu certo, pra sobreviver a soluço do banco

async function geracoes() {
  const agora = Date.now();
  if (cache && agora - cache.em < VALIDADE_CACHE) return cache.geracoes;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return ultimaBoa;

  try {
    const r = await fetch(`${url}/rest/v1/pdm_dados?select=valor&chave=eq.${CHAVE}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!r.ok) return ultimaBoa;
    const linhas = await r.json();
    const v = (Array.isArray(linhas) && linhas[0] && linhas[0].valor) || {};
    const out = {};
    for (const [p] of PAPEIS) {
      const n = Math.floor(Number(v[p]));
      out[p] = Number.isFinite(n) && n >= 1 ? n : 1;
    }
    cache = { geracoes: out, em: agora };
    ultimaBoa = out;
    return out;
  } catch {
    // Banco engasgou. Vale a última leitura boa; se nunca houve uma, deixa
    // passar — derrubar a cozinha inteira por causa de um soluço de rede seria
    // trocar um problema raro por um problema toda noite.
    return ultimaBoa;
  }
}

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

  const atuais = await geracoes();
  // Sem leitura ou com tudo na geração 1: nada foi cortado, nada pode estar
  // vencido. Sai daqui sem gastar uma conta sequer.
  if (!atuais || PAPEIS.every(([p]) => atuais[p] === 1)) return NextResponse.next();

  // A geração vem escrita no crachá; crachá antigo, de antes disto existir, é
  // geração 1 — que é justamente o caso do aparelho de quem já estava logado.
  const m = /^g(\d{1,6})\.(.+)$/.exec(cookie);
  const geracao = m ? Math.max(1, Number(m[1])) : 1;

  // De qual acesso é este crachá? O porteiro descobre refazendo a conta. O
  // cookie da DONA não bate com nenhum dos três — e aí ele passa direto, que é
  // como tem que ser: o acesso dela não se corta por aqui.
  const segredo = process.env.SESSION_SECRET || '';
  const tempero = geracao > 1 ? ':g' + geracao : '';
  for (const [papel, prefixo] of PAPEIS) {
    const esperado = await sha256hex(prefixo + segredo + tempero);
    const valor = m ? m[2] : cookie;
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
