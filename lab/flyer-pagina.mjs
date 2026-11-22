// "FAZ UMA PÁGINA COM O FLYER" — o link que ela manda pra qualquer pessoa.
//
// O QUE ESTE TESTE GUARDA:
//   - A PÁGINA ABRE SEM LOGIN e mostra o flyer de verdade (a imagem carrega).
//   - OS ARQUIVOS EXISTEM: PNG e PDF respondem 200, com o tipo certo, e o PDF é
//     mesmo um PDF.
//   - A PRÉVIA DO WHATSAPP: as tags og:image apontam pro flyer, com endereço
//     completo (senão a prévia sai cinza).
//   - OS BOTÕES: baixar a imagem, baixar o PDF, compartilhar e copiar o link
//     estão lá e apontam pros arquivos certos.
//   - O CAMINHO CONTINUA LIGADO: "Quero criar o meu bar" leva ao cadastro.
//
// LAB_ENV: ADMIN_PASSWORD=Admin@123
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };

console.log('\n— a página abre sem login —');
const html = await (await fetch(`${BASE}/flyer`)).text();
const res = await fetch(`${BASE}/flyer`);
cobra('/flyer responde 200 sem estar logada', res.status === 200, String(res.status));
cobra('a prévia do WhatsApp aponta pro flyer (og:image com endereço completo)', /property="og:image" content="https:\/\/pico-do-mane\.vercel\.app\/divulgar\/picoos-flyer\.png"/.test(html));
cobra('o título da prévia fala dos 14 dias grátis', /og:title" content="PicoOS — teu negócio no controle/.test(html) && /<title>PicoOS — 14 dias grátis<\/title>/.test(html));

console.log('\n— os arquivos —');
const png = await fetch(`${BASE}/divulgar/picoos-flyer.png`);
const pdf = await fetch(`${BASE}/divulgar/picoos-flyer.pdf`);
const bytesPdf = Buffer.from(await pdf.arrayBuffer());
const bytesPng = Buffer.from(await png.arrayBuffer());
cobra('o PNG responde 200 como imagem e é um PNG de verdade', png.status === 200 && /image\/png/.test(png.headers.get('content-type') || '') && bytesPng.slice(1, 4).toString() === 'PNG', png.headers.get('content-type'));
cobra('o PDF responde 200 como PDF e começa com %PDF', pdf.status === 200 && /pdf/.test(pdf.headers.get('content-type') || '') && bytesPdf.slice(0, 4).toString() === '%PDF', pdf.headers.get('content-type'));
cobra('o PDF tem uma página só (A4)', (bytesPdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 1);

console.log('\n— a tela —');
const browser = await chromium.launch();
const pg = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await pg.goto(`${BASE}/flyer`);
await pg.waitForSelector('[data-flyer-imagem]');
await pg.waitForFunction(() => { const i = document.querySelector('[data-flyer-imagem]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
const dims = await pg.evaluate(() => { const i = document.querySelector('[data-flyer-imagem]'); return { nat: i.naturalWidth, w: i.getBoundingClientRect().width }; });
cobra('o flyer aparece (a imagem carregou, 1588 px de largura de origem)', dims.nat === 1588, JSON.stringify(dims));
cobra('e cabe na tela do celular, sem barra de lado', dims.w <= 390 && await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), JSON.stringify(dims));
const href = (sel) => pg.locator(sel).getAttribute('href');
cobra('"Baixar a imagem" aponta pro PNG, com nome do arquivo', (await href('[data-baixar-imagem]')) === '/divulgar/picoos-flyer.png' && (await pg.locator('[data-baixar-imagem]').getAttribute('download')) === 'picoos-flyer.png');
cobra('"Baixar o PDF" aponta pro PDF', (await href('[data-baixar-pdf]')) === '/divulgar/picoos-flyer.pdf' && (await pg.locator('[data-baixar-pdf]').getAttribute('download')) === 'picoos-flyer.pdf');
cobra('tem "Compartilhar" e "Copiar o link"', await pg.locator('[data-compartilhar]').count() === 1 && await pg.locator('[data-copiar-link]').count() === 1);
// No computador do teste não existe a folha de compartilhar: cai pra "copiar o link".
await pg.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
await pg.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch { /* ignora */ } });
await pg.click('[data-compartilhar]');
await pg.waitForSelector('[data-aviso]');
const copiado = await pg.evaluate(() => navigator.clipboard.readText());
cobra('sem a folha de compartilhar do aparelho, "Compartilhar" copia o link do flyer', copiado === 'https://pico-do-mane.vercel.app/flyer', copiado);
await pg.click('[data-criar]');
await pg.waitForURL(/\/criar$/);
cobra('"Quero criar o meu bar" leva ao cadastro', await pg.locator('[data-form-cadastro]').count() === 1);

await browser.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
