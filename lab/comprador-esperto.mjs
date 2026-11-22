// "VOCÊ JÁ TEM ACESSO AOS MEUS PEDIDOS COM VALORES, ENTÃO QUERIA QUE DE ALGUMA
// FORMA ELE ME FALASSE QUAL O MELHOR PREÇO, MELHOR FORNECEDOR, DE ALGUMA FORMA
// PRÁTICA PRA FACILITAR AS COTAÇÕES."
//
// O QUE ESTE TESTE GUARDA:
//   - AS NOTAS DE COMPRAS VIRAM COTAÇÃO: o preço que ela pagou entra na
//     comparação, junto com as cotações digitadas.
//   - TUDO NA MESMA RÉGUA: caixa de 12 a R$ 84 é R$ 7,00 a unidade, e se
//     compara com a unidade avulsa a R$ 6,00.
//   - PREÇO VELHO NÃO DECIDE: uma nota de 200 dias atrás, baratíssima, não vira
//     "o mais barato".
//   - A ECONOMIA É EM REAIS POR MÊS, no consumo dela.
//   - O QUE SUBIU DE PREÇO aparece.
//   - UM FORNECEDOR SÓ: o app diz pra cotar com mais um.
//   - O PEDIDO PRONTO: a lista de compras dividida pelo mais barato de cada
//     item, com o total, o aviso de pedido mínimo e a mensagem do WhatsApp.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const gravar = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');
const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const HOJE = iso(agora);
const diasAtras = (n) => { const d = new Date(HOJE + 'T12:00:00'); d.setDate(d.getDate() - n); return iso(d); };

const p0 = (await linha('painel')) || {};
await gravar('painel', {
  ...p0,
  estoque: [
    { id: 'hei', nome: 'Heineken long neck', unidade: 'un', custo: '7', saldo: '30', categoria: 'Bebidas' },
    { id: 'gelo', nome: 'Gelo', unidade: 'saco', custo: '8', saldo: '5', categoria: 'Outros' },
    { id: 'lim', nome: 'Limão', unidade: 'kg', custo: '7', saldo: '2', categoria: 'Cozinha' },
  ],
  compras: [
    // Komprão: 24 unidades avulsas a R$ 6,00 (40 dias atrás)
    { id: 'c1', data: diasAtras(40), fornecedor: 'Komprão', produto: 'Heineken long neck', estoqueId: 'hei', quantidade: '24', valorUnit: '6', pago: 'Sim' },
    // Ambev: 2 caixas de 12 a R$ 84 = R$ 7,00 a unidade (10 dias atrás) — a última
    { id: 'c2', data: diasAtras(10), fornecedor: 'Ambev', produto: 'Heineken long neck', estoqueId: 'hei', quantidade: '2', valorUnit: '84', conteudo: '12', conteudoUnid: 'un', pago: 'Sim' },
    // Preço velho e baratíssimo: não pode decidir nada
    { id: 'c0', data: diasAtras(200), fornecedor: 'Distribuidora Antiga', produto: 'Heineken long neck', estoqueId: 'hei', quantidade: '24', valorUnit: '3', pago: 'Sim' },
    { id: 'c3', data: diasAtras(15), fornecedor: 'Mercado Central', produto: 'Limão', estoqueId: 'lim', quantidade: '3', valorUnit: '7', pago: 'Sim' },
    { id: 'c4', data: diasAtras(5), fornecedor: 'Gelo Ilha', produto: 'Gelo', estoqueId: 'gelo', quantidade: '10', valorUnit: '8', pago: 'Sim' },
  ],
  cotacoes: [
    { id: 'q1', data: diasAtras(5), produto: 'Limão', fornecedor: 'Ceasa', preco: '5', embalagem: 'kg', conteudo: '', minPedido: '50', prazoEntrega: '1' },
  ],
  listaCompras: [
    { id: 'l1', nome: 'Heineken long neck', quantidade: '24', comprado: false },
    { id: 'l2', nome: 'Limão', quantidade: '2', comprado: false },
    { id: 'l3', nome: 'Azeite', quantidade: '1', comprado: false },
    { id: 'l4', nome: 'Gelo', quantidade: '3', comprado: true },
  ],
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const pg = await ctx.newPage();
await pg.goto(BASE);
await pg.selectOption('select[data-quem]', 'dona');
await pg.fill('input[type=password]', 'Teste@123');
await pg.click('button[type=submit]');
await pg.waitForSelector('.pos-navitem', { timeout: 20000 });
await pg.evaluate(() => localStorage.setItem('picoos-tab', 'abastecimento'));
await pg.goto(BASE);
await pg.click('button:has-text("Cotações")');
await pg.waitForSelector('[data-comprador]', { timeout: 20000 });
const tudo = async () => limpa(await pg.locator('[data-comprador]').innerText());

console.log('\n— onde dá pra economizar —');
cobra('a economia do mês: R$ 18,00 (Heineken R$ 16 + limão R$ 2)', limpa(await pg.locator('[data-economia-mes]').innerText()).includes('R$ 18,00'), limpa(await pg.locator('[data-economia-mes]').innerText()));
const eco = limpa(await pg.locator('[data-economias]').innerText());
cobra('Heineken: compra no Komprão, R$ 6,00/un, 14% mais barato que a Ambev (R$ 7,00/un)', /Heineken long neck[\s\S]*−R\$ 16,00\/mês/.test(eco) && /Compra no Komprão: R\$ 6,00\/un.*14% mais barato que a tua última compra no Ambev \(R\$ 7,00\/un\)/.test(eco), eco.slice(0, 300));
cobra('a caixa de 12 a R$ 84 virou R$ 7,00 a unidade (mesma régua)', eco.includes('R$ 7,00/un'));
cobra('limão: a cotação do Ceasa (R$ 5/kg) ganha da nota do Mercado (R$ 7/kg)', /Limão[\s\S]*Compra no Ceasa: R\$ 5,00\/kg/.test(eco));
cobra('a nota velha e barata (200 dias) não vira "o mais barato"', !(await tudo()).includes('Distribuidora Antiga'));

console.log('\n— o que subiu —');
const sub = limpa(await pg.locator('[data-subiram]').innerText());
cobra('Heineken subiu 17% na última compra (R$ 6,00 → R$ 7,00, Ambev)', /Heineken long neck.*R\$ 6,00 → R\$ 7,00\/un \(Ambev/.test(sub) && sub.includes('+17%'), sub);

console.log('\n— procurar um produto —');
await pg.fill('[data-comprador] input', 'gelo');
await pg.waitForSelector('[data-achado="Gelo"]');
cobra('um fornecedor só: manda cotar com mais um', /Só tem preço de Gelo Ilha \(R\$ 8,00\/saco/.test(limpa(await pg.locator('[data-achado="Gelo"]').innerText())));
await pg.fill('[data-comprador] input', 'heinek');
await pg.waitForSelector('[data-achado="Heineken long neck"]');
const rank = limpa(await pg.locator('[data-achado="Heineken long neck"]').innerText());
const lista = rank.slice(rank.indexOf('★')); // só a lista, sem a frase de cima
cobra('o ranking: ★ Komprão R$ 6,00 em cima, Ambev R$ 7,00 embaixo, com a data da nota', lista.startsWith('★ Komprão') && lista.indexOf('Ambev') > lista.indexOf('R$ 6,00') && /nota de \d\d\/\d\d/.test(lista), lista);

console.log('\n— o pedido pronto —');
await pg.click('[data-montar-pedido] button:has-text("Montar pedido")');
await pg.waitForSelector('[data-pedido="Komprão"]');
const pk = limpa(await pg.locator('[data-pedido="Komprão"]').innerText());
cobra('Komprão: 24 × Heineken, ≈ R$ 144,00', pk.includes('24 × Heineken long neck') && pk.includes('≈ R$ 144,00'), pk);
const pc = limpa(await pg.locator('[data-pedido="Ceasa"]').innerText());
cobra('Ceasa: 2 × Limão, ≈ R$ 10,00, com o aviso do pedido mínimo (R$ 50,00)', pc.includes('2 × Limão') && pc.includes('≈ R$ 10,00') && /pedido mínimo dele \(R\$ 50,00\)/.test(pc), pc);
const mp = limpa(await pg.locator('[data-montar-pedido]').innerText());
cobra('o que já foi comprado (gelo) não entra no pedido', !mp.includes('3 × Gelo'));
cobra('o que não tem preço em lugar nenhum (azeite) aparece pra cotar', /Sem preço em lugar nenhum ainda: Azeite/.test(mp));
const zap = await pg.locator('[data-pedido="Komprão"] a:has-text("Mandar no WhatsApp")').getAttribute('href');
cobra('a mensagem do WhatsApp vem pronta com os itens', decodeURIComponent(zap || '').includes('• 24 Heineken long neck') && /^https:\/\/wa\.me\/\?text=/.test(zap || ''), decodeURIComponent(zap || '').slice(0, 80));

await browser.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
