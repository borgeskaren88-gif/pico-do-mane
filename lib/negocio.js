// QUEM É O DONO DESTE APP.
//
// "Tem a opção de um nome e cada um configura o seu?"
//
// Tem. São dois nomes, e eles são coisas diferentes:
//
//   - o nome do PRODUTO (PicoOS) é a marca, igual pra todo mundo;
//   - o nome do NEGÓCIO ("Pico do Mané") é de quem usa, e cada um põe o seu.
//
// Até aqui o nome do bar e o nome dela estavam escritos no código, em mais de
// trinta lugares. Isso faz o app servir a UMA pessoa. Aqui vira configuração:
// o app continua igualzinho pra ela (ela preenche os nomes dela), e passa a
// poder ser instalado pra outra pessoa sem nenhuma linha de código mudada.
//
// Nada aqui é obrigatório. Sem preencher, o app usa palavras neutras — "o
// negócio", "a dona" — e nunca fica com um nome de outra pessoa na tela.

export const PADRAO = {
  nome: '',            // "Pico do Mané"
  cidade: '',          // "Florianópolis"
  dona: '',            // como chamar quem manda: "Karen"
  // Como cada acesso se chama NA TELA. A chave é o papel (que o sistema usa);
  // o valor é a palavra que aparece. Um salão não tem "cozinha"; uma loja não
  // tem "atendimento de mesa".
  papeis: { dona: '', cozinha: '', garcom: '', reservas: '' },
};

const txt = (v, max = 40) => String(v == null ? '' : v).trim().slice(0, max);

// Lê a configuração de um blob do painel, sempre devolvendo o formato completo.
export function lerNegocio(blob) {
  const n = (blob && typeof blob.negocio === 'object' && blob.negocio) || {};
  const p = (n.papeis && typeof n.papeis === 'object') ? n.papeis : {};
  return {
    nome: txt(n.nome, 60),
    cidade: txt(n.cidade, 60),
    dona: txt(n.dona, 40),
    papeis: {
      dona: txt(p.dona), cozinha: txt(p.cozinha),
      garcom: txt(p.garcom), reservas: txt(p.reservas),
    },
  };
}

// O NOME QUE VAI NA TELA, com uma rede embaixo.
//
// Quando ela não preencheu, a tela NÃO pode ficar com um buraco ("Bom dia, ")
// nem com o nome de outra pessoa. Cai numa palavra neutra que serve pra
// qualquer negócio.
export const nomeDoNegocio = (n) => (n && n.nome) || 'o negócio';
export const nomeDaDona = (n) => (n && (n.dona || (n.papeis && n.papeis.dona))) || 'a dona';

// Como chamar um acesso na tela. `papel` é 'dona' | 'cozinha' | 'garcom' |
// 'reservas'. Sem configuração, usa o nome genérico da função.
const GENERICO = { dona: 'Dona', cozinha: 'Cozinha', garcom: 'Atendimento', reservas: 'Reservas' };
export function nomeDoPapel(n, papel) {
  const p = (n && n.papeis) || {};
  if (papel === 'dona') return p.dona || n?.dona || GENERICO.dona;
  return p[papel] || GENERICO[papel] || papel;
}

// Os quatro acessos, já com o nome que aparece na tela de entrada.
export const papeisParaLogin = (n) => ['dona', 'cozinha', 'garcom', 'reservas']
  .map((id) => [id, nomeDoPapel(n, id)]);

// Está configurado o bastante pra não parecer um app de outra pessoa?
export const estaConfigurado = (n) => !!(n && n.nome && (n.dona || (n.papeis && n.papeis.dona)));
