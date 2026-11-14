// "PRECISO CRIAR UM PERFIL PARA ATENDIMENTO, MAS QUE SEJA FEITO EXTRA."
//
// O extra é quem vem trabalhar um dia só. Ela escolheu: ele faz TUDO que o
// atendimento faz, com senha separada, e o ponto dele sai marcado como extra,
// sem se misturar com a equipe fixa.
//
// O QUE ESTE TESTE GUARDA:
//
//   - A PORTA NASCE FECHADA. Na maior parte dos dias não tem extra nenhum, e
//     uma porta com "1234" aberta pra internet nesses dias é uma porta que
//     ninguém está olhando. Sem a dona criar a senha, nada entra — e o botão
//     nem aparece na tela de entrada.
//   - A SENHA É SÓ DELE. A do atendimento não abre o extra, nem o contrário.
//   - ELE FAZ O QUE O ATENDIMENTO FAZ, e não mais: abre mesa, lança item — e
//     continua sem ver o financeiro.
//   - O PONTO DELE É DELE. Sai carimbado 'extra', não aparece pro atendimento
//     fixo, e um "João" extra não vira o mesmo João que trabalha lá todo dia.
//   - FECHAR O EXTRA NÃO DERRUBA NINGUÉM MAIS. A noite acabou: a senha some,
//     quem estava dentro cai, e o celular do atendimento fixo continua logado.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const painel = async () => (await linha('painel')) || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const pontos = async () => (await (await fetch(`${BANCO}?select=chave,valor&chave=like.${MARCA}ponto:*`)).json()).map((x) => x.valor);
const limpa = (s) => String(s || '').replace(/ /g, ' ');
const SENHA_EXTRA = 'Extra@77';

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  mesasQtd: 6,
  cardapio: [{ id: 'cv', nome: 'Heineken', categoria: 'Bebidas', preco: '14', ativo: true }],
  estoque: [], fichas: [], receitas: [], despesas: [], compras: [], diario: [], clientes: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const novo = async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  return pg;
};
const entrarPelaTela = async (pg, botao, senha) => {
  await pg.locator(`button:text-is("${botao}")`).first().click();
  await pg.locator('input[type="password"]').first().fill(senha);
  await pg.locator('button:has-text("Entrar")').first().click();
  await pg.waitForTimeout(3800);
};
// Bate direto no servidor, que é o que um curioso com um navegador consegue.
const tentar = (pg, papel, senha) => pg.evaluate(async (x) => {
  const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ papel: x.papel, senha: x.senha, lembrar: true }) });
  return r.status;
}, { papel, senha });
const pedir = (pg, url, corpo) => pg.evaluate(async (x) => {
  const r = await fetch(x.url, x.corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x.corpo) } : { cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch { /* sem corpo */ }
  return { status: r.status, j };
}, { url, corpo });
const botoesDaEntrada = (pg) => pg.evaluate(() => [...document.querySelectorAll('button[type="button"]')].map((e) => (e.innerText || '').trim()).filter(Boolean));

// ---------------------------------------------------------------------------
console.log('\n### A PORTA NASCE FECHADA');
const rua = await novo();   // ninguém logado: a internet
let nomes = (await pedir(rua, '/api/negocio')).j.papeis.map((x) => x[0]);
cobra('a tela de entrada não oferece "Extra"', !nomes.includes('extra'), nomes.join(','));
cobra('e o botão não aparece', !(await botoesDaEntrada(rua)).includes('Extra'), (await botoesDaEntrada(rua)).join(' | '));
// As senhas que um curioso tentaria primeiro.
cobra('"1234" não abre o extra', (await tentar(rua, 'extra', '1234')) === 401, String(await tentar(rua, 'extra', '1234')));
cobra('a senha da dona não abre o extra', (await tentar(rua, 'extra', 'Teste@123')) === 401);
cobra('senha vazia não abre o extra', (await tentar(rua, 'extra', '')) === 401);

// ---------------------------------------------------------------------------
console.log('\n### A DONA ABRE A PORTA, EM ACESSOS');
const dona = await novo();
dona.on('dialog', (d) => d.accept());
dona.on('pageerror', (e) => { console.log('[pageerror dona]', e.message.slice(0, 160)); ruim++; });
await entrarPelaTela(dona, 'Karen', 'Teste@123');
const tocar = (pg, rot) => pg.evaluate((r) => {
  const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
  const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
  if (x) { x.click(); return true; }
  return false;
}, rot);
// O cartão do extra, e só ele: os botões "Trocar a senha" se repetem em todos.
const noCartao = (pg, botao) => pg.evaluate((bt) => {
  const titulo = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /^extra \(atendimento de um dia\)$/i.test((d.textContent || '').trim()));
  const cartao = titulo && titulo.parentElement;
  if (!cartao) return null;
  if (!bt) return cartao.innerText;
  const x = [...cartao.querySelectorAll('button')].find((e) => (e.innerText || '').trim().toLowerCase() === bt.toLowerCase());
  if (x) { x.click(); return 'ok'; }
  return '';
}, botao);
// O aviso de senha de fábrica (cozinha e atendimento ainda estão em 1234 aqui)
// leva pra tela de Acessos.
cobra('chegou em Acessos', await tocar(dona, 'Trocar agora'));
await dona.waitForTimeout(1800);
let cartao = limpa(await noCartao(dona, ''));
cobra('tem o cartão do Extra', !!cartao, (cartao || '(não achou)').replace(/\s+/g, ' ').slice(0, 140));
cobra('que diz que está fechado', /fechado: ninguém entra por aqui/i.test(cartao || ''), (cartao || '').replace(/\s+/g, ' ').slice(0, 200));
// Fechado não é "senha de fábrica": não existe 1234 nenhum pra trocar.
cobra('e NÃO diz que está com senha de fábrica', !/senha de fábrica/i.test(cartao || ''), (cartao || '').replace(/\s+/g, ' ').slice(0, 200));
cobra('tocou em criar a senha', (await noCartao(dona, 'Criar a senha e abrir')) === 'ok');
await dona.waitForTimeout(500);
await dona.locator('input[placeholder="senha nova"]').first().fill(SENHA_EXTRA);
cobra('abriu o acesso', (await noCartao(dona, 'Abrir o acesso')) === 'ok');
await dona.waitForTimeout(2600);
cartao = limpa(await noCartao(dona, ''));
cobra('o cartão agora diz que está aberto', /aberto: quem tem a senha entra pelo botão "extra"/i.test(cartao || ''), (cartao || '').replace(/\s+/g, ' ').slice(0, 200));
cobra('a senha ficou guardada (só o hash)', !!(await linha('authExtra'))?.hash && !JSON.stringify(await linha('authExtra')).includes(SENHA_EXTRA),
  JSON.stringify(Object.keys((await linha('authExtra')) || {})));

// ---------------------------------------------------------------------------
console.log('\n### A SENHA É SÓ DELE');
nomes = (await pedir(rua, '/api/negocio')).j.papeis.map((x) => x[0]);
cobra('agora a tela de entrada oferece "Extra"', nomes.includes('extra'), nomes.join(','));
cobra('a senha do atendimento não abre o extra', (await tentar(rua, 'extra', '1234')) === 401);
cobra('e a do extra não abre o atendimento', (await tentar(rua, 'garcom', SENHA_EXTRA)) === 401);
cobra('nem a cozinha', (await tentar(rua, 'cozinha', SENHA_EXTRA)) === 401);

// ---------------------------------------------------------------------------
console.log('\n### ELE ENTRA PELO BOTÃO E CAI NA TELA DO ATENDIMENTO');
const extra = await novo();
extra.on('pageerror', (e) => { console.log('[pageerror extra]', e.message.slice(0, 160)); ruim++; });
cobra('o botão "Extra" está na tela de entrada', (await botoesDaEntrada(extra)).includes('Extra'), (await botoesDaEntrada(extra)).join(' | '));
await entrarPelaTela(extra, 'Extra', SENHA_EXTRA);
const telaExtra = limpa(await extra.locator('body').innerText());
// A tela do atendimento abre na aba Ponto, com Caixa e Comandas ao lado.
cobra('caiu na tela do atendimento, com as comandas', /central de operações/i.test(telaExtra) && /comandas/i.test(telaExtra), telaExtra.replace(/\s+/g, ' ').slice(0, 120));
// E não na da dona: nada de Finanças nem de Dashboard.
cobra('e não na tela da dona', !/finanças|dashboard/i.test(telaExtra), (telaExtra.match(/finanças|dashboard/gi) || ['(sem nada da dona, certo)']).join(' '));

console.log('\n### FAZ O QUE O ATENDIMENTO FAZ — E NÃO MAIS');
const cs = await pedir(extra, '/api/comandas');
cobra('lê o cardápio', cs.status === 200 && (cs.j.cardapio || []).some((i) => i.nome === 'Heineken'), String(cs.status));
const ab = await pedir(extra, '/api/comandas', { acao: 'abrir', mesa: '1', pessoas: 2 });
cobra('abre mesa', ab.status === 200 && !!ab.j.comanda?.id, JSON.stringify(ab.j).slice(0, 120));
const ad = await pedir(extra, '/api/comandas', { acao: 'add', comandaId: ab.j.comanda?.id, cardapioId: 'cv' });
cobra('lança item', ad.status === 200 && (ad.j.comanda?.itens || []).length === 1, JSON.stringify(ad.j).slice(0, 120));
// O que o atendimento não vê, o extra também não.
cobra('não vê as vendas (financeiro)', (await pedir(extra, '/api/vendas')).status === 401, String((await pedir(extra, '/api/vendas')).status));
cobra('não mexe nos acessos', (await pedir(extra, '/api/acessos')).status === 401);
cobra('nem abre a própria porta de novo', (await pedir(extra, '/api/acessos', { acao: 'senha', papel: 'extra', nova: 'outra1234' })).status === 401);

// ---------------------------------------------------------------------------
console.log('\n### O PONTO DELE É DELE');
const fixo = await novo();
await entrarPelaTela(fixo, 'Atendimento', '1234');
// O João de todo dia bate o ponto. Depois, o João que veio só hoje.
const pFixo = await pedir(fixo, '/api/ponto', { acao: 'entrada', nome: 'João' });
cobra('o João fixo bateu o ponto', pFixo.status === 200 && pFixo.j.registro?.papel === 'garcom', JSON.stringify(pFixo.j.registro || pFixo.j).slice(0, 120));
const pExtra = await pedir(extra, '/api/ponto', { acao: 'entrada', nome: 'João' });
cobra('o João extra bateu o dele — carimbado extra', pExtra.status === 200 && pExtra.j.registro?.papel === 'extra', JSON.stringify(pExtra.j.registro || pExtra.j).slice(0, 120));
// Com o mesmo nome, o app respondia "esse já está com o ponto aberto".
cobra('e NÃO foi confundido com o João fixo', !pExtra.j.jaAberto && pExtra.j.registro?.id !== pFixo.j.registro?.id, `jaAberto=${pExtra.j.jaAberto}`);
const noBanco = await pontos();
cobra('são dois turnos no banco, um de cada', noBanco.length === 2 && noBanco.map((x) => x.papel).sort().join(',') === 'extra,garcom', noBanco.map((x) => x.papel).join(','));
const veFixo = (await pedir(fixo, '/api/ponto')).j.registros || [];
const veExtra = (await pedir(extra, '/api/ponto')).j.registros || [];
cobra('o atendimento fixo não enxerga o ponto do extra', veFixo.length === 1 && veFixo[0].papel === 'garcom', veFixo.map((x) => x.papel).join(','));
cobra('e o extra não enxerga o ponto da equipe fixa', veExtra.length === 1 && veExtra[0].papel === 'extra', veExtra.map((x) => x.papel).join(','));
const sai = await pedir(extra, '/api/ponto', { acao: 'saida', nome: 'João' });
cobra('a saída do extra fecha o turno DELE', sai.status === 200 && sai.j.registro?.papel === 'extra' && !!sai.j.registro?.saida, JSON.stringify(sai.j.registro || sai.j).slice(0, 120));
cobra('e o do João fixo continua aberto', (await pontos()).some((x) => x.papel === 'garcom' && !x.saida), JSON.stringify((await pontos()).map((x) => [x.papel, !!x.saida])));

console.log('\n### NA TELA DA DONA, SEPARADO DOS FIXOS');
cobra('abriu o Ponto', await tocar(dona, 'Ponto'));
await dona.waitForTimeout(2400);
const telaPonto = limpa(await dona.locator('body').innerText());
cobra('o João extra aparece marcado EXTRA', /João\s*· EXTRA/.test(telaPonto), (telaPonto.match(/[^\n]*João[^\n]*/g) || ['(sem João)']).slice(0, 4).join(' | '));
cobra('e o João fixo aparece no Atendimento, em outra linha', /João\s*· Atendimento/.test(telaPonto), (telaPonto.match(/[^\n]*João[^\n]*/g) || []).slice(0, 4).join(' | '));
// Quem vem um dia só não tem jornada: mandar "configurar jornada" seria errado.
cobra('do extra a tela dá turnos e horas, pra ela calcular a diária', /Extra: 1 turno\(s\)/.test(telaPonto), (telaPonto.match(/[^\n]*Extra: [^\n]*/) || ['(não diz)'])[0]);
cobra('e não cobra escala de quem não tem', /extra — sem escala/i.test(telaPonto), (telaPonto.match(/[^\n]*sem escala[^\n]*/gi) || ['(não diz)']).join(' | '));

// ---------------------------------------------------------------------------
console.log('\n### A NOITE ACABOU: FECHAR O EXTRA SEM DERRUBAR NINGUÉM');
const gAntes = ((await linha('acessosGeracoes')) || {}).extra || 1;
cobra('voltou pra Acessos', await tocar(dona, 'Trocar agora'));
await dona.waitForTimeout(1800);
cobra('tocou em fechar o acesso', (await noCartao(dona, 'Fechar o acesso')) === 'ok');
await dona.waitForTimeout(2600);
cartao = limpa(await noCartao(dona, ''));
cobra('o cartão voltou a dizer fechado', /fechado: ninguém entra por aqui/i.test(cartao || ''), (cartao || '').replace(/\s+/g, ' ').slice(0, 160));
cobra('a senha foi apagada do banco', !(await linha('authExtra')), JSON.stringify(await linha('authExtra') || null));
const gDepois = ((await linha('acessosGeracoes')) || {}).extra || 1;
cobra('e a geração do extra subiu', gDepois > gAntes, `${gAntes} -> ${gDepois}`);
cobra('a senha antiga não entra mais', (await tentar(rua, 'extra', SENHA_EXTRA)) === 401);
nomes = (await pedir(rua, '/api/negocio')).j.papeis.map((x) => x[0]);
cobra('o botão "Extra" sumiu da tela de entrada', !nomes.includes('extra'), nomes.join(','));
// O porteiro guarda as gerações meio minuto na memória. Passado esse tempo, o
// crachá do extra tem que estar morto.
await rua.waitForTimeout(32000);
const depois = await pedir(extra, '/api/comandas');
cobra('quem estava dentro com o crachá do extra caiu', depois.status === 401, String(depois.status));
const fixoDepois = await pedir(fixo, '/api/comandas');
cobra('e o atendimento fixo continua logado', fixoDepois.status === 200, String(fixoDepois.status));
cobra('o ponto que o extra bateu continua guardado', (await pontos()).some((x) => x.papel === 'extra' && !!x.saida));

console.log('\n### SÓ O EXTRA FECHA');
const errado = await pedir(dona, '/api/acessos', { acao: 'fechar', papel: 'garcom' });
cobra('o atendimento de todo dia não pode ser "fechado"', errado.status === 400, JSON.stringify(errado.j).slice(0, 120));
cobra('e a senha dele continua valendo', (await tentar(rua, 'garcom', '1234')) === 200);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
