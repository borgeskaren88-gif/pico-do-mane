// "QUERIA PODER PÔR UMA FOTO DE PERFIL."
//
// Ela pediu no lugar onde vê o próprio nome: a tela de entrada. E aí apareceu
// uma escolha que não era minha pra fazer.
//
// A TELA DE ENTRADA É ABERTA. Ela acontece antes de existir senha, então o que
// estiver nela qualquer pessoa da internet lê sem entrar. Hoje ela mostra duas
// coisas, de propósito: o nome do bar e o nome dos acessos — as mesmas que já
// estão escritas na porta do estabelecimento. Está dito no código, em letras
// grandes, que não se acrescenta campo ali.
//
// Perguntei. Ela escolheu: só dentro do app.
//
// O QUE ESTE TESTE GUARDA:
//
//   - a foto aparece no bom-dia, depois do login;
//   - e NÃO aparece em /api/negocio, que é o endereço aberto. Esta é a parte
//     que importa: o dia em que alguém "melhorar" o login pondo o rosto dela
//     lá, isto cai. Vazamento de foto não dá erro em lugar nenhum — ele
//     simplesmente acontece, e ninguém fica sabendo;
//   - foto grande demais não entra no painel. O painel é lido inteiro a cada
//     abertura do app; uma foto de celular de 4 MB ali dentro faria o bar
//     esperar megabytes pra mostrar um círculo de 46 pixels;
//   - e texto que não é imagem também não entra.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// Um PNG 1x1 de verdade, pequeno. Serve de "foto" sem precisar de arquivo.
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// Uma "foto" grande demais pro painel: mais de 120 KB de base64.
const FOTO_GIGANTE = 'data:image/jpeg;base64,' + 'A'.repeat(130 * 1024);

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen' }, fotoDona: FOTO },
  cardapio: [], fichas: [], estoque: [], compras: [], receitas: [], despesas: [], diario: [],
});

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
pg.on('console', (m) => { const x = m.text(); if (m.type() === 'error' && !/status of 40/.test(x)) { console.log('[console]', x.slice(0, 160)); ruim++; } });

console.log('\n### O ENDEREÇO ABERTO NÃO CONHECE A FOTO');
// Antes de qualquer login. É esta a asserção que não pode cair nunca.
const aberto = await (await fetch(`${BASE}/api/negocio`)).text();
cobra('/api/negocio responde', aberto.length > 0);
cobra('e NÃO traz a foto', !/data:image/.test(aberto), aberto.slice(0, 200));
cobra('nem o campo fotoDona', !/fotoDona/.test(aberto), aberto.slice(0, 200));
// O que ele PODE trazer continua trazendo: é o que está na porta do bar.
cobra('mas ainda traz os nomes dos acessos', /Karen/.test(aberto), aberto.slice(0, 160));

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);

console.log('\n### E A TELA DE ENTRADA TAMBÉM NÃO MOSTRA');
const htmlLogin = await pg.content();
cobra('nenhuma imagem embutida na tela de senha', !/data:image\/(png|jpeg|webp);base64/.test(htmlLogin));
cobra('o nome do acesso continua lá', /Karen/.test(limpa(await pg.locator('body').innerText())));

await pg.locator('button:text-is("Karen")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(3800);

console.log('\n### DEPOIS DE ENTRAR, A FOTO APARECE NO BOM-DIA');
const temFoto = await pg.evaluate(() => [...document.querySelectorAll('img')]
  .some((i) => /^data:image\/png;base64,iVBOR/.test(i.src || '')));
cobra('a foto está no cabeçalho do Dashboard', temFoto);
cobra('e o bom-dia continua com o nome', /Karen/.test(limpa(await pg.locator('body').innerText())));

console.log('\n### SEM FOTO, O CABEÇALHO FICA COMO SEMPRE FOI');
// Círculo vazio pedindo pra ser preenchido é pior que nada: vira tarefa.
const p1 = await painel();
await gravar({ ...p1, negocio: { ...p1.negocio, fotoDona: '' } });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
const semFoto = await pg.evaluate(() => [...document.querySelectorAll('img')]
  .some((i) => /^data:image/.test(i.src || '')));
cobra('nenhum círculo vazio no lugar', !semFoto);
cobra('e o bom-dia segue inteiro', /Karen/.test(limpa(await pg.locator('body').innerText())));

console.log('\n### FOTO GRANDE DEMAIS NÃO ENTRA NO PAINEL');
// O painel é lido inteiro a cada abertura do app. Foto de celular ali dentro
// faria o bar esperar megabytes pra mostrar um círculo de 46 pixels.
const p2 = await painel();
await gravar({ ...p2, negocio: { ...p2.negocio, fotoDona: FOTO_GIGANTE } });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
const temGigante = await pg.evaluate(() => [...document.querySelectorAll('img')]
  .some((i) => (i.src || '').length > 100000));
cobra('a gigante foi recusada', !temGigante);

console.log('\n### E O QUE NÃO É IMAGEM TAMBÉM NÃO');
const p3 = await painel();
await gravar({ ...p3, negocio: { ...p3.negocio, fotoDona: 'javascript:alert(1)' } });
await pg.reload({ waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(3600);
const temLixo = await pg.evaluate(() => [...document.querySelectorAll('img')]
  .some((i) => /javascript:/i.test(i.getAttribute('src') || '')));
cobra('texto que não é foto foi recusado', !temLixo);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
