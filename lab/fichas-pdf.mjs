// "PRECISO DE UM LUGAR ONDE EU COLOQUE AS FICHAS TÉCNICAS, TIPO UMA GALERIA —
// EU JÁ TENHO TUDO SALVO EM PDF."
//
// O trabalho dela já estava feito. Faltava estar no bar: em PDF no celular
// dela, a ficha só existe quando ela está presente — e ficha técnica serve
// justamente pra quando ela NÃO está.
//
// O QUE ESTE TESTE GUARDA, e por quê:
//
//   - O PDF NÃO ENTRA NO PAINEL. É a asserção que paga o teste. O painel é
//     lido INTEIRO toda vez que o app abre; meia dúzia de fichas lá dentro
//     faria o bar esperar megabytes pra desenhar a tela de entrada, e ninguém
//     veria a causa — só o app "ficando lento". O arquivo vai pro depósito e
//     no banco fica só a etiqueta.
//   - A COZINHA VÊ E NÃO MEXE. Foi a escolha dela. Botão escondido não é
//     trava: o teste bate direto no servidor com o crachá da cozinha, que é o
//     que um navegador consegue fazer sozinho.
//   - CADA BAR SÓ ALCANÇA A PRÓPRIA PASTA. O nome do negócio entra no caminho
//     do arquivo; se um dia isso cair, um cliente lê a ficha do outro e
//     ninguém fica sabendo.
//   - APAGAR LEVA O ARQUIVO JUNTO. Tirar só a etiqueta deixaria o PDF no
//     depósito pra sempre, pago e invisível.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const LAB = 'http://127.0.0.1:54321/__lab';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');
const linhas = async (prefixo) => (await (await fetch(`${BANCO}?select=chave,valor&chave=like.${MARCA}${prefixo}*`)).json());
const noDeposito = async () => (await (await fetch(`${LAB}/arquivos`)).json());

// Um PDF minúsculo, mas PDF de verdade: começa com %PDF- e termina com %%EOF.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
  + '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n'
  + 'trailer<</Root 1 0 R>>\n%%EOF\n', 'utf8');

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', cozinha: 'Cozinha' } },
  cardapio: [], fichas: [], estoque: [], compras: [], receitas: [], despesas: [], diario: [],
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

const texto = async () => limpa(await pg.locator('body').innerText());
const irPara = async (rot) => {
  const achou = await pg.evaluate((r) => {
    const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === r);
    if (x) { x.click(); return true; }
    return false;
  }, rot);
  await pg.waitForTimeout(1600);
  cobra(`achou o caminho "${rot}"`, achou);
};

await irPara('Abastecimento');
await irPara('Fichas em PDF');
await pg.waitForTimeout(1200);

console.log('\n### A GALERIA VAZIA DIZ O QUE FAZER');
// Tela vazia e muda é o jeito mais rápido de uma função nascer e nunca ser
// usada: ela abre, não entende, e não volta.
let txt = await texto();
cobra('a tela existe', /Fichas em PDF/.test(txt), txt.slice(0, 80).replace(/\n/g, ' | '));
cobra('diz que está vazia', /Nenhuma ficha aqui ainda/.test(txt));
cobra('e convida a mandar os PDFs', /Manda os PDFs que tu já tem/.test(txt));

console.log('\n### MANDANDO DUAS FICHAS DE UMA VEZ');
// Ela tem a pasta inteira no celular. Um por um seria tarefa que não termina.
await pg.setInputFiles('input[type="file"]', [
  { name: 'Batata Frita Clássica.pdf', mimeType: 'application/pdf', buffer: PDF },
  { name: 'Caipirinha da casa.pdf', mimeType: 'application/pdf', buffer: PDF },
]);
await pg.waitForTimeout(3500);
txt = await texto();
cobra('a primeira apareceu na galeria', /Batata Frita Clássica/.test(txt), txt.replace(/\n/g, ' | ').slice(0, 200));
cobra('e a segunda também', /Caipirinha da casa/.test(txt));
cobra('o nome vem do arquivo, sem o ".pdf"', !/\.pdf/i.test(txt), (txt.match(/[^\n]*\.pdf[^\n]*/i) || [''])[0]);

console.log('\n### O PDF NÃO ENTRA NO PAINEL — e esta é a razão do teste');
// O painel é lido inteiro a cada abertura do app.
const p1 = await painel();
const tamanhoPainel = JSON.stringify(p1).length;
cobra('o painel continua pequeno', tamanhoPainel < 20000, `${tamanhoPainel} caracteres`);
cobra('e não tem nada de PDF dentro dele', !/%PDF|JVBER/.test(JSON.stringify(p1)));
const etiquetas = await linhas('fichaarq:');
cobra('são duas etiquetas, uma por ficha', etiquetas.length === 2, `achei ${etiquetas.length}`);
const umaEtiqueta = JSON.stringify(etiquetas[0] && etiquetas[0].valor || {});
cobra('a etiqueta guarda só o caminho, não o arquivo', umaEtiqueta.length < 400 && /caminho/.test(umaEtiqueta), umaEtiqueta);
cobra('e nada de base64 nela', !/JVBER|base64/.test(umaEtiqueta), umaEtiqueta.slice(0, 160));

console.log('\n### O ARQUIVO FOI PRO DEPÓSITO, NA PASTA DESTE BAR');
// O nome do negócio entra no caminho. Se isso cair, um cliente lê a ficha do
// outro — e vazamento de arquivo não dá erro em lugar nenhum.
const noDep = await noDeposito();
cobra('tem dois arquivos guardados', noDep.length === 2, JSON.stringify(noDep));
cobra('dentro da pasta do Pico do Mané', noDep.every((c) => c.includes('/n/pico-do-mane/fichas/')), JSON.stringify(noDep));
cobra('e nenhum fora dela', !noDep.some((c) => /\.\./.test(c)), JSON.stringify(noDep));

console.log('\n### E ABRE DE VERDADE, COM PDF DE VERDADE DO OUTRO LADO');
// Cartão bonito que não abre é pior que não ter: ela descobre no sábado.
const link = await pg.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((x) => /\/storage\/v1\/object\/sign\//.test(x.href || ''));
  return a ? a.href : '';
});
cobra('o cartão tem link pro arquivo', /object\/sign\//.test(link), link.slice(0, 120));
const baixado = await (await fetch(link)).arrayBuffer();
cobra('o que volta é um PDF', Buffer.from(baixado).slice(0, 5).toString() === '%PDF-', Buffer.from(baixado).slice(0, 12).toString());
cobra('e é o mesmo arquivo que subiu', Buffer.from(baixado).length === PDF.length, `${Buffer.from(baixado).length} vs ${PDF.length}`);

console.log('\n### DÁ PRA CORRIGIR O NOME');
// O PDF dela pode chamar "ficha_final_v3". Na galeria tem que ser o prato.
await pg.evaluate(() => {
  const bt = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'nome');
  if (bt) bt.click();
});
await pg.waitForTimeout(600);
await pg.evaluate(() => {
  const campo = [...document.querySelectorAll('input')].find((i) => i.type !== 'file' && /Batata|Caipirinha/.test(i.value || ''));
  if (!campo) return;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, 'Porção de batata G');
  campo.dispatchEvent(new Event('input', { bubbles: true }));
});
await pg.evaluate(() => {
  const bt = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'Salvar');
  if (bt) bt.click();
});
await pg.waitForTimeout(2200);
txt = await texto();
cobra('o nome novo aparece', /Porção de batata G/.test(txt), txt.replace(/\n/g, ' | ').slice(0, 200));

console.log('\n### A COZINHA VÊ, MAS NÃO MEXE');
// Botão escondido não é trava. Aqui eu bato direto no servidor com o crachá da
// cozinha — que é o que um navegador consegue fazer sozinho.
const ctxCoz = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const coz = await ctxCoz.newPage();
await coz.goto(BASE, { waitUntil: 'domcontentloaded' });
await coz.waitForTimeout(1600);
await coz.locator('button:text-is("Cozinha")').first().click();
await coz.locator('input[type="password"]').first().fill('1234');
await coz.locator('button:has-text("Entrar")').first().click();
await coz.waitForTimeout(3800);
await coz.evaluate(() => {
  const x = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === 'Fichas');
  if (x) x.click();
});
await coz.waitForTimeout(2000);
const txtCoz = limpa(await coz.locator('body').innerText());
cobra('a cozinha enxerga a ficha', /Porção de batata G/.test(txtCoz), txtCoz.replace(/\n/g, ' | ').slice(0, 200));
cobra('e não vê o campo de mandar arquivo', !/Adicionar fichas/.test(txtCoz));
cobra('nem o botão de apagar', !/apagar/.test(txtCoz), (txtCoz.match(/[^\n]*apagar[^\n]*/) || [''])[0]);

const idFicha = (etiquetas[0] && etiquetas[0].valor && etiquetas[0].valor.id) || '';
const tentativa = await coz.evaluate(async (id) => {
  const r = await fetch(`/api/fichas-arquivo?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  return { status: r.status, corpo: (await r.text()).slice(0, 120) };
}, idFicha);
cobra('o servidor recusa a cozinha apagando', tentativa.status === 401, JSON.stringify(tentativa));
const subida = await coz.evaluate(async () => {
  const fd = new FormData();
  fd.append('arquivo', new Blob(['%PDF-1.4 falso'], { type: 'application/pdf' }), 'invasao.pdf');
  const r = await fetch('/api/fichas-arquivo', { method: 'POST', body: fd });
  return r.status;
});
cobra('e recusa a cozinha mandando arquivo', subida === 401, String(subida));
// Contar duas não basta: a cozinha podia ter apagado uma E subido outra, e o
// total voltaria a dois com a ficha dela no lugar da minha.
const depoisDaCozinha = await linhas('fichaarq:');
cobra('a ficha que ela tentou apagar continua lá', depoisDaCozinha.some((l) => l.valor && l.valor.id === idFicha), JSON.stringify(depoisDaCozinha.map((l) => l.valor && l.valor.nome)));
cobra('e nada de "invasao" entrou', !depoisDaCozinha.some((l) => /invasao/i.test(JSON.stringify(l.valor || {}))), JSON.stringify(depoisDaCozinha.map((l) => l.valor && l.valor.nome)));
cobra('continuam sendo duas', depoisDaCozinha.length === 2, String(depoisDaCozinha.length));
await ctxCoz.close();

console.log('\n### APAGAR LEVA O ARQUIVO JUNTO');
// Tirar só a etiqueta deixaria o PDF no depósito pra sempre: pago, invisível e
// impossível de achar depois.
pg.on('dialog', (d) => d.accept());
await pg.evaluate(() => {
  const bt = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'apagar');
  if (bt) bt.click();
});
await pg.waitForTimeout(2600);
cobra('sobrou uma etiqueta', (await linhas('fichaarq:')).length === 1, String((await linhas('fichaarq:')).length));
cobra('e sobrou um arquivo no depósito', (await noDeposito()).length === 1, JSON.stringify(await noDeposito()));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
