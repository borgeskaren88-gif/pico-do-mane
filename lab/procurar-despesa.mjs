// "QUERO QUE A PARTE DE DESPESAS SEJA INTELIGENTE: QUE EU CONSIGA SABER QUANTO
// GASTEI DE PRÓ-LABORE EM 90 DIAS, E QUE SE EU PESQUISAR UMA PALAVRA-CHAVE TIPO
// 'CLAUDE' ELE PUXE TUDO O QUE PAGUEI COM ESSE NOME."
//
// A tela tinha um filtro de MÊS e mais nada. Pra responder "quanto de
// pró-labore nos últimos 90 dias" ela abria três meses, anotava três números
// num papel e somava. Pra achar "claude" ela lia a lista inteira com o olho.
//
// O QUE ESTE TESTE GUARDA:
//
//   - A BUSCA PERDOA COMO A PESSOA ESCREVE. No banco está "Pró-labore
//     (sócios)", com acento e hífen; ela digita "pro labore". Busca literal
//     não acharia nada e ela concluiria, com razão, que o app não procura.
//   - TODAS AS PALAVRAS PRECISAM APARECER, não qualquer uma. Com "qualquer
//     uma", procurar duas palavras devolveria meio arquivo.
//   - 90 DIAS É 90 DIAS. O que caiu fora da janela fica fora da soma — e é
//     justamente o lançamento velho que inflaria o número sem ela ver.
//   - A COMPARAÇÃO É COM JANELA DO MESMO TAMANHO. Comparar 90 dias com um mês
//     solto diria que o gasto caiu dois terços quando não caiu nada.
//   - E A BUSCA ACHA O QUE ESTÁ ESCRITO EM QUALQUER CAMPO: categoria,
//     descrição ou observação. Ninguém lembra onde digitou.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
// brl() escreve espaço DURO (U+00A0). Procurar com o espaço do teclado não
// acha nada, e a asserção passa a não valer nada.
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const menos = (n) => { const d = new Date(`${hojeBR()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const HOJE = hojeBR();

// DATAS AMARRADAS NA JANELA, não em meses do calendário. Semear "setembro"
// daria um teste que passa em novembro e falha em janeiro.
const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  despesas: [
    // PRÓ-LABORE: três dentro dos 90 dias (1.500 cada = 4.500) e um fora.
    { id: 'pl1', data: menos(5), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1500', obs: '' },
    { id: 'pl2', data: menos(35), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1500', obs: '' },
    { id: 'pl3', data: menos(65), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1500', obs: '' },
    // Nos 90 dias ANTERIORES (dia 91 a 180): 1.000 + 1.000 = 2.000.
    { id: 'pl4', data: menos(100), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1000', obs: '' },
    { id: 'pl5', data: menos(140), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1000', obs: '' },

    // CLAUDE: escrito em três campos diferentes e em duas categorias, que é
    // como as coisas de verdade ficam depois de uns meses de uso.
    { id: 'cl1', data: menos(10), categoria: 'Assinaturas', descricao: 'Claude', valor: '120', obs: '' },
    { id: 'cl2', data: menos(40), categoria: 'Assinaturas', descricao: 'claude code', valor: '120', obs: '' },
    { id: 'cl3', data: menos(70), categoria: 'Sistemas', descricao: 'Anthropic', valor: '100', obs: 'assinatura do Claude' },

    // O RUÍDO: parecidos de propósito, pra provar que a busca não puxa tudo.
    { id: 'rd1', data: menos(12), categoria: 'Distribuição de lucros', descricao: 'retirada', valor: '800', obs: '' },
    { id: 'rd2', data: menos(14), categoria: 'Energia elétrica', descricao: 'Celesc', valor: '430', obs: '' },
    { id: 'rd3', data: menos(16), categoria: 'Gás', descricao: 'Botijão', valor: '160', obs: '' },
    { id: 'rd4', data: menos(18), categoria: 'Fornecedores de insumo', descricao: 'Cozinha do Zé', valor: '250', obs: '' },
  ],
  receitas: [], compras: [], estoque: [], cardapio: [], fichas: [], diario: [], clientes: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('button:text-is("Karen")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

// innerText obedece o text-transform do CSS: comparo sem ligar pra caixa.
const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
    const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1600);
  cobra(`achou o caminho "${rot}"`, achou);
};
const digitar = (v) => pg.evaluate((x) => {
  const campo = [...document.querySelectorAll('input')].find((i) => /procurar/i.test(i.placeholder || ''));
  if (!campo) return false;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, x);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, v);
const texto = async () => limpa(await pg.locator('body').innerText());

await irPara('Finanças');
await irPara('Despesas');
await pg.waitForTimeout(1200);
await irPara('Procurar');
await pg.waitForTimeout(1000);

// SÓ O PEDAÇO DO RESULTADO. O corpo inteiro tem o resumo do topo e a lista, e
// procurar reais em qualquer lugar faria asserção passar pelo motivo errado.
const bloco = (t) => {
  const i = t.indexOf('"pro labore"') >= 0 ? t.indexOf('"pro labore"') : t.search(/"[^"]+"\s*·/);
  return i < 0 ? '' : t.slice(i, i + 420);
};

console.log('\n### 90 DIAS DE PRÓ-LABORE, SEM ABRIR TRÊS MESES');
cobra('o campo de procurar existe', await digitar('pro labore'));
await pg.waitForTimeout(900);
let txt = await texto();
// 1.500 × 3 = 4.500. O de 100 dias atrás NÃO entra.
cobra('somou R$ 4.500,00 nos 90 dias', /R\$ 4\.500,00/.test(bloco(txt)), bloco(txt).split('\n').slice(0, 4).join(' | ') || '(sem bloco)');
cobra('e diz que são 3 lançamentos', /\b3 lançamentos/.test(bloco(txt)), (txt.match(/[^\n]*lançamentos?[^\n]*/) || ['(não diz)'])[0]);
// O de R$ 1.000 que ficou de fora é exatamente o que inflaria a conta.
cobra('NÃO somou o pró-labore de 100 dias atrás', !/R\$ 5\.500,00/.test(txt) && !/R\$ 6\.500,00/.test(txt),
  (txt.match(/R\$ [\d.]+,\d\d/g) || []).slice(0, 5).join(' '));
cobra('diz quanto dá por mês: R$ 1.500,00', /R\$ 1\.500,00 por mês/.test(bloco(txt)),
  (txt.match(/[^\n]*por mês[^\n]*/) || ['(não diz)'])[0]);

console.log('\n### E COMPARA COM OS 90 DIAS ANTERIORES');
// Antes: 1.000 + 1.000 = 2.000. De 2.000 pra 4.500 é +125%.
cobra('mostra os R$ 2.000,00 do período anterior', /antes disso: R\$ 2\.000,00/i.test(bloco(txt)),
  (txt.match(/[^\n]*antes disso[^\n]*/i) || ['(não compara)'])[0]);
cobra('e avisa que subiu 125%', /subiu 125%/i.test(bloco(txt)),
  (txt.match(/[^\n]*(subiu|caiu)[^\n]*/i) || ['(não diz quanto)'])[0]);

console.log('\n### A BUSCA PERDOA ACENTO, HÍFEN E PARÊNTESE');
// No banco está "Pró-labore (sócios)". Ela digitou "pro labore", sem nada.
cobra('achou mesmo ela escrevendo sem acento e sem hífen', /Pró-labore \(sócios\)/.test(txt), '(a categoria de verdade tem acento, hífen e parêntese)');

console.log('\n### "CLAUDE" PUXA TUDO QUE FOI PAGO COM ESSE NOME');
cobra('digitou claude', await digitar('claude'));
await pg.waitForTimeout(900);
txt = await texto();
// 120 + 120 + 100 = 340, em duas categorias e achado em três campos.
cobra('somou R$ 340,00', /R\$ 340,00/.test(bloco(txt)), bloco(txt).split('\n').slice(0, 4).join(' | ') || '(sem bloco)');
cobra('são 3 lançamentos', /\b3 lançamentos/.test(bloco(txt)), (txt.match(/[^\n]*lançamentos?[^\n]*/) || ['(não diz)'])[0]);
cobra('achou o que estava na DESCRIÇÃO', /claude code/i.test(txt), '(cl2)');
cobra('e o que só estava na OBSERVAÇÃO', /assinatura do Claude/i.test(txt), '(cl3: a descrição dele é "Anthropic")');
cobra('mostra que está espalhado em 2 categorias', /Assinaturas/.test(txt) && /Sistemas/.test(txt), '(Assinaturas e Sistemas)');
// O ruído tem que ficar de fora: achar o Celesc procurando "claude" seria o
// mesmo que não ter busca.
cobra('e não puxou a conta de luz nem o botijão', !/Celesc/.test(txt) && !/Botijão/.test(txt),
  (txt.match(/Celesc|Botijão/g) || ['(ficaram de fora, certo)']).join(' '));

console.log('\n### TODAS AS PALAVRAS PRECISAM APARECER');
cobra('digitou duas palavras que não convivem', await digitar('claude energia'));
await pg.waitForTimeout(900);
txt = await texto();
cobra('não devolve nada, em vez de devolver os dois', /Nada com "claude energia"/i.test(txt),
  (txt.match(/[^\n]*Nada com[^\n]*/i) || ['(devolveu alguma coisa)'])[0]);

console.log('\n### O PERÍODO MANDA NA SOMA');
cobra('voltou pro pró-labore', await digitar('pro labore'));
await pg.waitForTimeout(700);
const tocar = (rot) => pg.evaluate((r) => {
  const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
  const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
  if (x) { x.click(); return true; }
  return false;
}, rot);
cobra('tocou em "30 dias"', await tocar('30 dias'));
await pg.waitForTimeout(900);
txt = await texto();
cobra('em 30 dias sobra só R$ 1.500,00', /R\$ 1\.500,00/.test(bloco(txt)) && !/R\$ 4\.500,00/.test(bloco(txt)),
  bloco(txt).split('\n').slice(0, 4).join(' | '));
cobra('tocou em "12 meses"', await tocar('12 meses'));
await pg.waitForTimeout(900);
txt = await texto();
// Agora entram os cinco: 1500×3 + 1000×2 = 6.500.
cobra('em 12 meses aparecem os R$ 6.500,00', /R\$ 6\.500,00/.test(bloco(txt)), bloco(txt).split('\n').slice(0, 4).join(' | '));
cobra('e são 5 lançamentos', /\b5 lançamentos/.test(bloco(txt)), (txt.match(/[^\n]*lançamentos?[^\n]*/) || ['(não diz)'])[0]);

console.log('\n### COM O CAMPO VAZIO, A TELA OFERECE ONDE MAIS SAIU DINHEIRO');
cobra('apagou a busca', await digitar(''));
await pg.waitForTimeout(900);
txt = await texto();
cobra('sugere categorias pra tocar', /Toca pra ver, ou digita o que tu quiser/i.test(txt),
  (txt.match(/[^\n]*Toca pra ver[^\n]*/i) || ['(não sugere nada)'])[0]);
cobra('e o pró-labore está entre elas', /Pró-labore \(sócios\) R\$ 6\.500,00/.test(txt),
  (txt.match(/[^\n]*Pró-labore \(sócios\) R\$[^\n]*/) || ['(não aparece com valor)'])[0]);

console.log('\n### E A ABA DE LANÇAR CONTINUA INTEIRA');
cobra('voltou pra "Lançar"', await tocar('Lançar'));
await pg.waitForTimeout(900);
txt = await texto();
cobra('o formulário de lançar está lá', /Novo lançamento — Despesa/i.test(txt),
  (txt.match(/[^\n]*lançamento —[^\n]*/i) || ['(sumiu)'])[0]);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
