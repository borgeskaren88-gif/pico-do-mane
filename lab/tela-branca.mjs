// A TELA BRANCA DO 3G.
//
// Ela mandou print do celular: branco puro, nada escrito, e o app não abria.
// O socorro que já existia no layout não tinha disparado — e não tinha por
// que: ele cuida de PEDAÇO QUE FALTOU e pinta a tela de escuro quando age.
// Branco puro é outra coisa: é o HTML que chegou e o programa que ainda está
// vindo. No 3G do bar isso leva segundos, e nesses segundos o app não dizia
// uma palavra.
//
// Pior: sem nada na tela, ela não tem como saber se é o celular dela, a
// internet ou o sistema caído. Foi exatamente a dúvida que ela teve.
//
// O QUE ESTE TESTE GUARDA:
//
//   - a tela NUNCA fica em branco calada: desde o primeiro instante tem
//     "PicoOS · abrindo…", escrito dentro da própria página, sem depender de
//     baixar nada;
//   - quando demora demais, ela para de dizer "abrindo" e diz a verdade —
//     está devagar, pode ser a internet, e tem um botão;
//   - e some assim que o app monta, sem ficar por cima do que já abriu. Esta
//     é a parte perigosa: tela de abertura que não sai tranca o app melhor
//     que qualquer bug.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const limpa = (s) => String(s || '').replace(/ /g, ' ');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

console.log('\n### NO CARREGAMENTO NORMAL, A TELA DE ABERTURA SAI SOZINHA');
// A parte perigosa: tela de abertura que não sai tranca o app melhor que
// qualquer bug. Service worker LIGADO aqui, ao contrário das outras suítes.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', (e) => erros.push(e.message.slice(0, 120)));
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  const existe = await pg.evaluate(() => !!document.getElementById('picoos-abrindo'));
  cobra('a tela de abertura sumiu depois de montar', existe === false);
  const txt = limpa(await pg.locator('body').innerText());
  cobra('e o app apareceu no lugar', /Entrar|Dona|Karen/i.test(txt), txt.slice(0, 80));
  cobra('sem erro de página', erros.length === 0, erros.join(' | '));
  await ctx.close();
}

console.log('\n### COM O PROGRAMA TRAVADO NO MEIO DO CAMINHO');
// É o 3G dela: o HTML chega, os pedaços do app ficam pendurados. Antes isso
// era branco puro e calado.
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  // Segura os pedaços do app sem derrubar: pendurado, igual internet fraca.
  // Abortar viraria ERRO, e erro já tem o socorro de cima — o que eu quero
  // medir aqui é a DEMORA, que não dispara erro nenhum.
  await pg.route('**/_next/static/chunks/**', () => { /* nunca responde */ });
  await pg.goto(BASE, { waitUntil: 'commit' });
  await pg.waitForTimeout(1200);

  // MEDIR A CAPA, NÃO O CORPO.
  //
  // "A tela não está em branco" passava mesmo sem conserto nenhum: o Next já
  // manda a tela de login dentro do HTML, então sempre tem texto ali. Só que
  // quem está LOGADO cai no Dashboard, que é todo client — e aí o HTML vem
  // praticamente vazio. Foi o caso dela.
  //
  // Então o que vale medir é a CAPA: ela existe, está visível e cobre a tela.
  const capa = await pg.evaluate(() => {
    const el = document.getElementById('picoos-abrindo');
    if (!el) return null;
    const c = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      visivel: c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) !== 0,
      cobre: r.width >= window.innerWidth - 2 && r.height >= window.innerHeight - 2,
      texto: (el.innerText || '').trim(),
    };
  });
  cobra('a capa de abertura existe', capa !== null, JSON.stringify(capa));
  cobra('está visível', !!capa && capa.visivel === true, JSON.stringify(capa));
  cobra('e cobre a tela inteira', !!capa && capa.cobre === true, JSON.stringify(capa));
  cobra('diz o nome do app', !!capa && /PicoOS/.test(capa.texto), JSON.stringify(capa && capa.texto));
  cobra('e diz que está abrindo', !!capa && /abrindo/i.test(capa.texto), JSON.stringify(capa && capa.texto));

  console.log('\n### E QUANDO DEMORA DEMAIS, PARA DE DIZER "ABRINDO" E DIZ A VERDADE');
  await pg.waitForTimeout(8200);
  const txt = await pg.evaluate(() => {
    const el = document.getElementById('picoos-abrindo');
    return el ? (el.innerText || '').trim() : '(a capa sumiu)';
  });
  cobra('avisa que está demorando', /demorando mais que o normal/i.test(txt), txt.slice(0, 120));
  cobra('aponta a internet do aparelho', /internet deste aparelho/i.test(txt));
  cobra('oferece tentar de novo', /Tentar de novo/i.test(txt));
  // Sem isso, a primeira coisa que passa na cabeça dela é "perdi tudo".
  cobra('e diz que não se perde dado', /dados est[aã]o salvos no servidor/i.test(txt), txt.slice(0, 200));
  cobra('o botão existe de verdade', await pg.evaluate(() => !!document.getElementById('picoos-abrindo-bt')));

  // O BOTÃO TEM QUE FAZER MAIS QUE RECARREGAR.
  //
  // Recarregar puro cai no mesmo buraco: o aparelho guarda a página pra abrir
  // rápido, e se ela aponta pra um pedaço do app que não chega, abrir de novo
  // aponta pro mesmo pedaço. Foi o que aconteceu com ela — saiu e voltou duas
  // vezes, e continuou branco.
  await pg.evaluate(() => caches.open('picoos-teste').then((c) => c.put('/marca-de-teste', new Response('x'))));
  cobra('tinha cache guardado antes de tocar', await pg.evaluate(() => caches.keys().then((k) => k.length > 0)));
  await pg.evaluate(() => { const b = document.getElementById('picoos-abrindo-bt'); if (b) b.click(); });
  await pg.waitForTimeout(1200);
  cobra('jogou fora a cópia guardada no aparelho', await pg.evaluate(() => caches.keys().then((k) => k.length === 0)));
  await ctx.close();
}

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
