// "QUERO UMA TELA EM QUE EU VEJA QUANTAS PESSOAS TEM NO BAR E QUEM ESTÁ
// TRABALHANDO, NESSA PEGADA" — a do escritório de bonequinhos de joguinho.
//
// O que este teste guarda:
//   - pessoas no bar = soma das pessoas das comandas abertas;
//   - mesas ocupadas de quantas (e a mesa aberta acima do cadastro aparece);
//   - equipe = ponto aberto; quem já saiu, ponto esquecido (mais de 16 h) e
//     nome repetido ficam de fora;
//   - no desenho: um bonequinho sentado por pessoa (até 4 por mesa, e "+3"
//     pra quem passa disso), um em pé com o nome pra cada um da equipe;
//   - tocar na mesa mostra quem está, há quanto tempo e quanto já deu;
//   - a dona e a gerente olham; o atendimento não.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (k) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${k}`)).json())[0]?.valor;
const grava = (k, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${k}`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

const p0 = (await linha('painel')) || {};
await grava('painel', { ...p0, negocio: { nome: 'Pico do Mané', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } }, mesasQtd: 12 });
const ag = Date.now();
const cm = (id, mesa, pessoas, min, itens, extra = {}) => grava(`comanda:${id}`, { id, mesa: String(mesa), status: 'aberta', pessoas, abertaEm: new Date(ag - min * 60000).toISOString(), itens: itens.map(([n, q, p]) => ({ id: n, nome: n, qtd: q, preco: p })), nome: '', ...extra });
await cm('c1', 1, 4, 95, [['Heineken', 6, 14], ['Batata', 1, 39.9]]);
await cm('c2', 3, 7, 40, [['Chopp', 8, 14.99]], { nome: 'Aniversário da Tamara' });
await cm('c3', 6, 2, 12, [['Caipirinha', 2, 18]], { servico: false });
await cm('c4', 15, 3, 65, [['Porção', 1, 69.9]]);       // mesa acima das 12 do cadastro
const pt = (id, nome, papel, min, saida = null) => grava(`ponto:${id}`, { id, nome, papel, entrada: new Date(ag - min * 60000).toISOString(), saida, data: '2026-11-21' });
await pt('p1', 'Sarah Lima', 'gerente', 200);
await pt('p2', 'João', 'garcom', 180);
await pt('p3', 'Ana', 'cozinha', 210);
await pt('p4', 'Bruno', 'extra', 60);
await pt('p5', 'Tamires', 'garcom', 300, new Date(ag - 30 * 60000).toISOString()); // já saiu
await pt('p6', 'Zeca', 'garcom', 20 * 60);                                         // esqueceu o ponto aberto
await pt('p7', 'joão', 'garcom', 170);                                             // o mesmo João, toque repetido
// 4 + 7 + 2 + 3 = 16 pessoas · 4 mesas de 13 · equipe: Sarah, João, Ana, Bruno

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const novo = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); const pg = await c.newPage(); pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; }); return pg; };
const entrar = async (pg, papel, senha) => {
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1800);
  await pg.locator('select[data-quem]').selectOption(papel);
  await pg.locator('input[type="password"]').fill(senha);
  await pg.locator('button:has-text("Entrar")').click(); await pg.waitForTimeout(4000);
};
const pedir = (pg, url) => pg.evaluate(async (u) => { const r = await fetch(u, { cache: 'no-store' }); let j = null; try { j = await r.json(); } catch { /* */ } return { status: r.status, j }; }, url);
const tocar = (pg, rot) => pg.evaluate((r) => { const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').replace(/ /g, ' ').trim().toLowerCase() === r.toLowerCase()); if (x) { x.click(); return true; } return false; }, rot);

console.log('\n### OS NÚMEROS');
const dona = await novo();
await entrar(dona, 'dona', 'Teste@123');
const j = (await pedir(dona, '/api/aovivo')).j;
cobra('16 pessoas no bar', j.pessoasNoBar === 16, String(j.pessoasNoBar));
cobra('4 mesas ocupadas de 13 (a mesa 15 aparece mesmo acima do cadastro)', j.mesasOcupadas === 4 && j.mesasTotal === 13 && j.mesas.some((m) => m.numero === '15' && m.ocupada), `${j.mesasOcupadas}/${j.mesasTotal}`);
cobra('equipe: Sarah, João, Ana e Bruno (sem quem saiu, sem o ponto esquecido, sem repetir o João)', j.equipe.map((p) => p.nome).sort().join(',') === 'Ana,Bruno,João,Sarah Lima', j.equipe.map((p) => p.nome).join(','));
const m3 = j.mesas.find((m) => m.numero === '3');
cobra('a mesa 3: 7 pessoas, 8 itens, R$ 131,91 com os 10%', m3.pessoas === 7 && m3.itens === 8 && m3.total === 131.91, JSON.stringify(m3));
cobra('a mesa 6 sem os 10%: R$ 36,00', j.mesas.find((m) => m.numero === '6').total === 36);
cobra('a que está há mais tempo: mesa 1, 1h35', j.maisAntiga?.numero === '1' && j.maisAntiga?.minutos === 95, JSON.stringify(j.maisAntiga));

console.log('\n### NA TELA');
cobra('o menu tem "Bar ao vivo"', await tocar(dona, 'Bar ao vivo'));
await dona.waitForTimeout(2500);
cobra('em cima: 16 pessoas no bar, 4/13 mesas, 4 na equipe',
  /16/.test(limpa(await dona.locator('[data-stat="pessoas"]').innerText())) && /4\/13/.test(limpa(await dona.locator('[data-stat="mesas"]').innerText())) && /4/.test(limpa(await dona.locator('[data-stat="equipe"]').innerText())));
const fila = limpa(await dona.locator('[data-equipe-fila]').innerText());
cobra('a fila da equipe com os nomes', ['Sarah', 'João', 'Ana', 'Bruno'].every((n) => fila.includes(n)) && !/Tamires|Zeca/.test(fila), fila);
const naCena = await dona.locator('[data-pessoa-equipe]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-pessoa-equipe')}:${e.getAttribute('data-setor')}`));
cobra('no desenho, 4 bonequinhos da equipe, cada um com o setor', naCena.length === 4 && naCena.includes('Ana:cozinha') && naCena.includes('Sarah Lima:gerente'), naCena.join(' '));
cobra('e a plaquinha com o nome de cada um', (await dona.locator('[data-placa]').count()) === 4);
const sentados = await dona.locator('[data-sentado]').count();
cobra('um bonequinho sentado por pessoa, até 4 por mesa: 4 + 4 + 2 + 3 = 13', sentados === 13, String(sentados));
cobra('e "+3" na mesa 3 (7 pessoas)', (await dona.locator('[data-mesa="3"] [data-mais="3"]').count()) === 1);
cobra('plaquinha nas 4 mesas ocupadas, e as livres sem plaquinha', (await dona.locator('[data-rotulo-mesa]').count()) === 4 && (await dona.locator('[data-mesa][data-ocupada="0"]').count()) === 9);
await dona.locator('[data-rotulo-mesa="3"]').click(); await dona.waitForTimeout(300);
const det = limpa(await dona.locator('[data-mesa-detalhe]').innerText());
cobra('tocar na mesa 3 mostra: Aniversário da Tamara, 7 pessoas, 40 min, R$ 131,91', /Mesa 3 · Aniversário da Tamara/.test(det) && /7 pessoas/.test(det) && /40 min/.test(det) && /R\$ 131,91/.test(det), det);
const lista = await dona.locator('[data-aberta]').evaluateAll((els) => els.map((e) => e.getAttribute('data-aberta')));
cobra('a lista "Mesas abertas" começa pela que está há mais tempo', lista.join(',') === '1,15,3,6', lista.join(','));

console.log('\n### QUEM PODE OLHAR');
await pedir(dona, '/api/aovivo');
await dona.evaluate(async () => fetch('/api/acessos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'senha', papel: 'gerente', nova: 'Sarah@2026' }) }));
const sarah = await novo();
await entrar(sarah, 'gerente', 'Sarah@2026');
cobra('a gerente olha', (await pedir(sarah, '/api/aovivo')).j?.pessoasNoBar === 16);
const joao = await novo();
await entrar(joao, 'garcom', '1234');
cobra('o atendimento não', (await pedir(joao, '/api/aovivo')).status === 401);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
