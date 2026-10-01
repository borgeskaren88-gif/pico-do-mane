// Com extensão de propósito: assim este arquivo roda também fora do Next, no
// laboratório, onde os testes de vazamento o atacam direto — sem subir o app.
import { supabaseServer } from './supabase.js';

// A PEÇA DO MEIO: QUEM DIZ DE QUEM É CADA LINHA.
//
// Até aqui, "de quem é este dado?" tinha uma resposta de fora do dado: de quem
// for o dono deste site. Um site por cliente, um banco por cliente. O Supabase
// dá 2 projetos no plano grátis, então esse caminho morre no segundo cliente.
//
// Agora o dono vai no NOME da linha:
//
//     painel       ->  n:boteco:painel
//     venda:k7x2   ->  n:boteco:venda:k7x2
//                      n:estimado:painel
//
// Só que são 135 lugares no código que falam com o banco. Carimbar o dono em
// 135 lugares na mão é esquecer um — e o lugar esquecido não dá erro vermelho:
// ele devolve a linha de OUTRO cliente, calado, pra sempre.
//
// Então ninguém carimba na mão. Todo pedido passa por aqui, e aqui carimba. A
// regra que vale pra tudo neste arquivo:
//
//     ERRAR TEM QUE QUEBRAR A TELA, NUNCA VAZAR DADO.
//
// Tela quebrada se descobre em cinco minutos. Vazamento se descobre pelo
// cliente, tarde demais. Por isso, aqui dentro:
//
//   - pedir o banco sem dizer de que negócio é    -> estoura;
//   - buscar sem filtrar por chave                -> vira busca só deste negócio;
//   - apagar sem filtrar por chave                -> estoura (não apaga "tudo");
//   - mexer em outra tabela                       -> estoura.
//
// Nenhuma dessas quatro devolve dado de ninguém.

const TABELA = 'pdm_dados';

// Nome de negócio: minúsculas, números e hífen. É ele que entra no nome da
// linha, então não pode ter ":" (separador) nem "%" nem "_" (curingas do LIKE),
// senão um negócio conseguiria escrever um nome que casa com o do vizinho.
const NOME_OK = /^[a-z0-9][a-z0-9-]{1,30}$/;

export function nomeDeNegocioValido(id) {
  return NOME_OK.test(String(id || ''));
}

export function marcaDe(id) {
  if (!nomeDeNegocioValido(id)) throw new Error(`Nome de negócio inválido: ${JSON.stringify(id)}`);
  return `n:${id}:`;
}

// Tira a marca de volta, pra quem chamou ver a chave como sempre viu ("painel",
// "venda:k7x2"). Linha de outro negócio nunca deveria chegar aqui; se chegar,
// ela é DESCARTADA em vez de devolvida sem marca — de novo: quebrar, não vazar.
function despirLinha(linha, marca) {
  if (!linha || typeof linha !== 'object' || typeof linha.chave !== 'string') return linha;
  if (!linha.chave.startsWith(marca)) return null;
  return { ...linha, chave: linha.chave.slice(marca.length) };
}

function despirResposta(r, marca) {
  if (!r || typeof r !== 'object' || !('data' in r)) return r;
  const d = r.data;
  if (Array.isArray(d)) return { ...r, data: d.map((l) => despirLinha(l, marca)).filter((l) => l !== null) };
  if (d && typeof d === 'object') { const u = despirLinha(d, marca); return { ...r, data: u }; }
  return r;
}

const carimbarLinha = (l, marca) => (l && typeof l === 'object' && typeof l.chave === 'string'
  ? { ...l, chave: marca + l.chave } : l);
const carimbar = (corpo, marca) => (Array.isArray(corpo)
  ? corpo.map((l) => carimbarLinha(l, marca)) : carimbarLinha(corpo, marca));

// Traduz os argumentos de cada método. Só a coluna "chave" é tocada — e é a
// única que o PicoOS filtra (63 .eq, 31 .like, 2 .in; nenhum filtro em outra
// coluna). Filtro em qualquer outra coluna NÃO conta como filtro de dono, de
// propósito: quem filtra por outra coisa ainda ia varrer o banco inteiro.
function traduzir(metodo, args, marca, estado) {
  const col = args[0];
  if ((metodo === 'eq' || metodo === 'neq') && col === 'chave') {
    estado.filtrouChave = true;
    return [col, marca + String(args[1]), ...args.slice(2)];
  }
  if ((metodo === 'like' || metodo === 'ilike') && col === 'chave') {
    estado.filtrouChave = true;
    return [col, marca + String(args[1]), ...args.slice(2)];
  }
  if (metodo === 'in' && col === 'chave') {
    estado.filtrouChave = true;
    return [col, (Array.isArray(args[1]) ? args[1] : []).map((k) => marca + String(k)), ...args.slice(2)];
  }
  if (metodo === 'upsert' || metodo === 'insert') return [carimbar(args[0], marca), ...args.slice(1)];
  if (metodo === 'update') return [carimbar(args[0], marca), ...args.slice(1)];
  if (metodo === 'delete') { estado.apaga = true; return args; }
  return args;
}

function envolver(consulta, marca, estado) {
  return new Proxy(consulta, {
    get(alvo, prop) {
      // A hora de executar. É o último momento em que dá pra impedir uma
      // besteira, então é aqui que mora a rede de segurança.
      if (prop === 'then') {
        if (!estado.filtrouChave) {
          // Apagar sem dizer o quê apagaria o negócio inteiro de uma vez. Nenhum
          // lugar do PicoOS faz isso hoje, e se um dia alguém escrever, tem que
          // doer na hora — não meses depois.
          if (estado.apaga) {
            return (_ok, falha) => {
              const e = new Error('Apagar sem filtrar por chave não é permitido.');
              return falha ? Promise.resolve(falha(e)) : Promise.reject(e);
            };
          }
          // Buscar sem filtro varreria o banco TODO — isto é, todos os
          // negócios. Vira uma busca só deste negócio.
          alvo.like('chave', marca + '%');
          estado.filtrouChave = true;
        }
        return (ok, falha) => alvo.then(
          (r) => { const v = despirResposta(r, marca); return ok ? ok(v) : v; },
          falha,
        );
      }
      const v = Reflect.get(alvo, prop);
      if (typeof v !== 'function') return v;
      return (...args) => {
        const r = v.apply(alvo, traduzir(prop, args, marca, estado));
        return (r && typeof r === 'object' && typeof r.then === 'function') ? envolver(r, marca, estado) : r;
      };
    },
  });
}

// O banco de UM negócio. É assim que toda rota passa a pedir dado.
//
// Sem nome de negócio não existe "o banco" — existe o banco de alguém. Por isso
// chamar sem nome estoura em vez de devolver algo: a rota que esquecer vai dar
// tela de erro no desenvolvimento, não leitura do vizinho em produção.
export function bancoDo(negocio) {
  const marca = marcaDe(negocio);
  const sb = supabaseServer();
  return {
    negocio: String(negocio),
    marca,
    from(tabela) {
      if (tabela !== TABELA) throw new Error(`Tabela não permitida: ${tabela}`);
      return envolver(sb.from(tabela), marca, { filtrouChave: false, apaga: false });
    },
  };
}
