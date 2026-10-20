// "3,5KG O GALÃO" — E O TECLADO DO IPAD SÓ TEM PONTO.
//
// Ela me disse o tamanho do galão de ketchup de viva voz: 3,5 kg. Pra digitar
// isso no iPad ela tem um teclado numérico que não tem vírgula — só ponto. E o
// ponto com três casas, pra quem lê como `num`, é separador de MILHAR: "3.500"
// virava três mil e quinhentos.
//
// POR QUE ISSO É DINHEIRO:
//
//   O preço por unidade é preço ÷ conteúdo. Galão de R$ 175 com 3,5 kg sai a
//   R$ 50,00 o quilo. Lido como 3500, sai a R$ 0,05 — e aí esse fornecedor
//   aparece como o mais barato da lista, por mil vezes, sempre. O erro aponta
//   pro lado de "tá barato", que é o pior lado: ela compra do caro pensando
//   que é o barato.
//
// AS DUAS PONTAS QUE ESTE TESTE GUARDA:
//
//   - a régua de LEITURA: "Cada um tem" em Cotações e Compras é fração por
//     natureza (barril de 30 L, pacote de 2 kg, galão de 3,5 kg). Lê-se com
//     `numQtd`, onde ponto é decimal;
//   - a régua da TELA: o campo é QtdInput, que troca o ponto por vírgula
//     enquanto ela digita. Ela VÊ "3,5" e julga na hora, em vez de descobrir
//     depois no preço;
//   - e o campo HOMÔNIMO do Estoque, que é o contrário: "Conteúdo por unidade"
//     é em ml/g/un, onde mil é o normal (garrafa de 1000 ml, saco de 5000 g).
//     Lá a régua é `num` de propósito. Mesmo rótulo, grandeza diferente — e o
//     teste tem que provar que eu não "consertei" o certo junto com o errado.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/\u00A0/g, ' ');

const hoje = new Date().toISOString().slice(0, 10);

// A CONTA FEITA NA MÃO:
//   galão de ketchup ... R$ 175,00, 3,5 kg dentro  →  175 ÷ 3,5  = R$ 50,00/kg
//   lido como 3500 ..... R$ 175,00 ÷ 3500          →  R$ 0,05/kg  (a mentira)
//   o concorrente ...... R$ 120,00, 2 kg dentro    →  120 ÷ 2    = R$ 60,00/kg
// Com a régua certa, o galão de 3,5 kg é o mais barato por R$ 10 o quilo.
// Com a errada, ele é o mais barato por mil vezes — e a tela mente na mesma
// direção quer o galão seja bom negócio, quer seja péssimo.
const CERTO = 'R$ 50,00';
const MENTIRA = 'R$ 0,05';

const p0 = await painel();
await gravar({ ...p0,
  estoque: [{ id: 'ket', nome: 'Ketchup', custo: '50', unidade: 'kg', saldo: '7', categoria: 'Cozinha' }],
  cardapio: [], fichas: [], compras: [], receitas: [], despesas: [], diario: [],
  cotacoes: [
    // Do jeito que sai do teclado do iPad: ponto, três casas.
    { id: 'q1', data: hoje, produto: 'Ketchup', fornecedor: 'Elogiata', preco: '175', categoria: 'Fornecedores de insumo', embalagem: 'kg', conteudo: '3.500' },
    { id: 'q2', data: hoje, produto: 'Ketchup', fornecedor: 'Zé Distribuidora', preco: '120', categoria: 'Fornecedores de insumo', embalagem: 'kg', conteudo: '2' },
  ],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1600);
await pg.locator('button:text-is("Dona")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

const texto = async () => limpa(await pg.locator('body').innerText());
const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1800);
  cobra(`achou o caminho "${rot}"`, achou);
};
// Preenche um campo achando o input pelo rótulo ao lado.
const campo = async (rotulo, valor) => {
  const ok = await pg.evaluate(([r, v]) => {
    const lim = (s) => String(s || '').replace(/ /g, ' ').trim();
    const lab = [...document.querySelectorAll('div')].find((d) => lim(d.textContent) === r && d.children.length === 0);
    const c = lab && lab.parentElement && lab.parentElement.querySelector('input');
    if (!c) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(c, v); c.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, [rotulo, valor]);
  cobra(`preencheu "${rotulo}" com ${valor}`, ok);
  await pg.waitForTimeout(400);
};
const valorDoCampo = async (rotulo) => pg.evaluate((r) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ').trim();
  const lab = [...document.querySelectorAll('div')].find((d) => lim(d.textContent) === r && d.children.length === 0);
  const c = lab && lab.parentElement && lab.parentElement.querySelector('input');
  return c ? c.value : '(não achou o campo)';
}, rotulo);

await irPara('Abastecimento');
await irPara('Cotações');
await pg.waitForTimeout(900);

console.log('\n### O GALÃO DE 3,5 KG VALE R$ 50,00 O QUILO, NÃO R$ 0,05');
let txt = await texto();
cobra(`o menor por unidade é ${CERTO}`, txt.includes(CERTO), (txt.match(/[^\n]*Menor por unidade[^\n]*\n[^\n]*/) || ['(não calculou)'])[0]);
cobra(`e NÃO ${MENTIRA} (o ponto lido como milhar)`, !txt.includes(MENTIRA));
cobra('o concorrente de 2 kg sai a R$ 60,00', txt.includes('R$ 60,00'), (txt.match(/[^\n]*60,00[^\n]*/) || [''])[0]);

console.log('\n### a lista de medidas tem ml e g — meio bar é vendido assim');
// Ela foi cotar o "Xarope Monin 700ml" e só havia kg e L. Sem ml, a saída à
// mão é digitar 700 e escolher L: a cotação passa a dizer setecentos LITROS e
// o preço por unidade vira preço ÷ 700.000 ml. O fornecedor fica eternamente
// "o mais barato". A lista de Compras já tinha os dois; esta ficou pra trás.
const medidas = await pg.evaluate(() => {
  const s2 = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === 'fardo'));
  return s2 ? [...s2.options].map((o) => o.value).filter(Boolean) : [];
});
cobra('tem ml', medidas.includes('ml'), medidas.join(' '));
cobra('tem g', medidas.includes('g'), medidas.join(' '));
cobra('e não perdeu as que já tinha', ['un', 'cx', 'fardo', 'pct', 'saco', 'grf', 'kg', 'L'].every((u) => medidas.includes(u)), medidas.join(' '));

console.log('\n### e o campo mostra a vírgula enquanto ela digita');
// O teclado do iPad só tem ponto. Se a tela deixa "3.500" na cara dela, ela
// não tem como saber que o sistema vai ler outra coisa.
await campo('Produto', 'Ketchup');
await campo('Fornecedor', 'Teste do ponto');
await campo('Preço (R$)', '175');
await campo('Cada um tem', '3.5');
cobra('digitou com ponto e o campo mostra "3,5"', (await valorDoCampo('Cada um tem')) === '3,5', await valorDoCampo('Cada um tem'));
await campo('Cada um tem', '3.500');
cobra('e "3.500" aparece como "3,500" — fração, não milhar', (await valorDoCampo('Cada um tem')) === '3,500', await valorDoCampo('Cada um tem'));

console.log('\n### salva e a conta continua certa');
cobra('tocou em salvar', await pg.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => /^(Salvar|Adicionar)/.test((e.innerText || '').trim()));
  if (x) { x.click(); return true; }
  return false;
}));
await pg.waitForTimeout(2400);
const guardada = (await painel()).cotacoes.find((c) => c.fornecedor === 'Teste do ponto');
cobra('guardou com vírgula, do jeito que ela viu', guardada && String(guardada.conteudo) === '3,500', JSON.stringify(guardada && { c: guardada.conteudo }));
txt = await texto();
cobra(`a nova linha também sai a ${CERTO}`, txt.includes(CERTO));
cobra(`e nenhuma linha virou ${MENTIRA}`, !txt.includes(MENTIRA));

console.log('\n### MAS O CAMPO HOMÔNIMO DO ESTOQUE É O CONTRÁRIO — e continua assim');
// "Conteúdo por unidade" é em ml/g/un: garrafa de 1000 ml, saco de 5000 g.
// Mil é o normal ali e fração quase não existe. Se eu tivesse trocado a régua
// dos dois juntos, a garrafa de 1000 ml teria virado 1 ml — e o custo da dose
// sairia mil vezes maior.
await irPara('Estoque');
await pg.waitForTimeout(900);
await campo('Produto', 'Garrafa de teste');
await campo('Conteúdo por unidade (opcional)', '1000');
cobra('1000 ml fica 1000, sem virar 1', (await valorDoCampo('Conteúdo por unidade (opcional)')) === '1000', await valorDoCampo('Conteúdo por unidade (opcional)'));
// E o campo NÃO pode ser QtdInput aqui: QtdInput troca ponto por vírgula, e
// "1.000" (mil) viraria "1,000" — lido como UM. Foi o engano que eu quase
// cometi "unificando" as duas telas. O campo tem que deixar o ponto em paz.
await campo('Conteúdo por unidade (opcional)', '1.000');
cobra('e "1.000" continua "1.000" — ponto de milhar, não vírgula', (await valorDoCampo('Conteúdo por unidade (opcional)')) === '1.000', await valorDoCampo('Conteúdo por unidade (opcional)'));

console.log('\n### e lá o AVISO fala do mesmo número que o botão grava');
// Aqui havia duas réguas na MESMA tela: o aviso vermelho lia o campo como
// fração (`numQtd`) e o salvar lia como milhar (`num`). Ela digitava "1.500" e
// a caixa vermelha explicava um 1,5 que não era o que ia pro banco. Caixa de
// aviso que descreve outro número não avisa nada — confunde.
const escolher = async (rotulo, valor) => pg.evaluate(([r, v]) => {
  const lim = (s) => String(s || '').replace(/ /g, ' ').trim();
  const lab = [...document.querySelectorAll('div')].find((d) => lim(d.textContent) === r && d.children.length === 0);
  const s2 = lab && lab.parentElement && lab.parentElement.querySelector('select');
  if (!s2) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  set.call(s2, v); s2.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [rotulo, valor]);
cobra('pôs a unidade em kg', await escolher('Unidade', 'kg'));
await pg.waitForTimeout(400);
await campo('Conteúdo por unidade (opcional)', '1.500');
cobra('pôs o conteúdo em g', await escolher('De quê', 'g') || await pg.evaluate(() => {
  const ss = [...document.querySelectorAll('select')].filter((x) => [...x.options].some((o) => o.value === 'g') && x.options.length <= 5);
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  if (ss.length) { set.call(ss[ss.length - 1], 'g'); ss[ss.length - 1].dispatchEvent(new Event('change', { bubbles: true })); return true; }
  return false;
}));
await pg.waitForTimeout(900);
txt = await texto();
cobra('o aviso apareceu', /mas 1 kg são/.test(txt), (txt.match(/[^\n]*Isso diz que[^\n]*/) || ['(sem aviso)'])[0]);
cobra('e fala de 1.500 g — o que o save grava', /1 kg tem 1\.500 g/.test(txt), (txt.match(/[^\n]*1 kg tem[^\n]*/) || [''])[0]);
cobra('não de 1,5 g (a régua errada)', !/1 kg tem 1,5 g/.test(txt));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
