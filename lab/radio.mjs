// O RÁDIO: "SE EU QUISER FALAR COM A SARAH, APERTO UM BOTÃO E JÁ FALO".
//
// O que este teste guarda:
//
//   - SEGURA, FALA, SOLTA: a Karen segura o botão, o microfone (de mentira,
//     aqui) grava, e ao soltar o recado vai pro servidor — um WAV de verdade,
//     16 mil amostras por segundo, que qualquer aparelho toca.
//   - SÓ QUEM DEVE OUVE: recado pra Sarah não chega pro atendimento — nem na
//     lista, nem pedindo o áudio direto.
//   - QUEM OUVE NÃO TOCA EM NADA: o recado chega e toca sozinho, com a tarja
//     "Karen falando". Se o aparelho não deixar tocar sozinho, a tarja vira
//     um botão "Ouvir".
//   - O QUE NÃO FOI OUVIDO FICA: bolinha vermelha com quantos faltam ouvir.
//   - RECADO VELHO SOME: depois de um dia o áudio sai do banco.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const gravarLinha = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor: v }]) });
const recadosNoBanco = async () => (await (await fetch(`${BANCO}?select=chave,valor&chave=like.${MARCA}radio:*`)).json());
const limpa = (s) => String(s || '').replace(/ /g, ' ');

// Um WAV de 1 segundo, feito aqui, pra mandar pela API sem microfone.
function wavDeTeste(seg = 1) {
  const n = Math.round(16000 * seg);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i += 1) b.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), 44 + i * 2);
  return b.toString('base64');
}

const p0 = (await linha('painel')) || {};
await gravarLinha('painel', { ...p0, negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } } });
await gravarLinha('jornadas', { gerente: { nome: 'Sarah Lima', dias: [3, 4, 5, 6], entrada: '16:00', saida: '00:00', salarioMes: 3200 } });
// Um recado de dois dias atrás, pra ver se some.
const velhoTs = Date.now() - 2 * 24 * 3600e3;
const velhoId = `${String(velhoTs).padStart(13, '0')}-velho1`;
await gravarLinha(`radio:${velhoId}`, { id: velhoId, de: 'dona', deNome: 'Karen', para: 'todos', paraNome: 'Todos', segundos: 1, ts: velhoTs, mime: 'audio/wav', audio: wavDeTeste(0.5) });

// Microfone e alto-falante de mentira: o Chromium inventa um bipe no lugar da
// voz, e deixa tocar som sem ninguém ter tocado na tela.
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
// Escuta o tocador: guarda cada som que começou a tocar e quanto tempo durou.
const ESCUTA = () => {
  window.__tocou = [];
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play() {
    const el = this;
    if (window.__bloquearSom && !String(el.src).startsWith('data:')) return Promise.reject(new DOMException('bloqueado', 'NotAllowedError'));
    if (!el.__escutando) {
      el.__escutando = true;
      el.addEventListener('playing', () => { if (String(el.src).startsWith('blob:')) window.__tocou.push({ dur: el.duration, src: el.src }); });
    }
    return orig.call(this);
  };
};
const novo = async ({ bloquear = false } = {}) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['microphone'] });
  await ctx.addInitScript(ESCUTA);
  if (bloquear) await ctx.addInitScript(() => { window.__bloquearSom = true; });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
  pg.on('dialog', (d) => d.accept());
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  return pg;
};
const entrar = async (pg, papel, senha) => {
  await pg.locator('select[data-quem]').selectOption(papel);
  await pg.locator('input[type="password"]').first().fill(senha);
  await pg.locator('button:has-text("Entrar")').first().click();
  await pg.waitForTimeout(4000);
};
const pedir = (pg, url, corpo) => pg.evaluate(async (x) => {
  const r = await fetch(x.url, x.corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x.corpo) } : { cache: 'no-store' });
  let j = null; try { j = await r.json(); } catch { /* sem json */ }
  return { status: r.status, j };
}, { url, corpo });

// ---------------------------------------------------------------------------
console.log('\n### QUEM NÃO ENTROU NÃO USA O RÁDIO');
const rua = await novo();
cobra('sem login, o rádio não responde', (await pedir(rua, '/api/radio')).status === 401);
cobra('nem aceita recado', (await pedir(rua, '/api/radio', { para: 'todos', audio: wavDeTeste(), segundos: 1 })).status === 401);

const dona = await novo();
await entrar(dona, 'dona', 'Teste@123');
await pedir(dona, '/api/acessos', { acao: 'senha', papel: 'gerente', nova: 'Sarah@2026' });
const sarah = await novo();
await entrar(sarah, 'gerente', 'Sarah@2026');
const joao = await novo();
await entrar(joao, 'garcom', '1234');

console.log('\n### PRA QUEM DÁ PRA FALAR');
const dd = (await pedir(dona, '/api/radio')).j;
cobra('a Karen fala com: Todos, Sarah, Cozinha, Atendimento', (dd.destinos || []).map((x) => x[1]).join(',') === 'Todos,Sarah,Cozinha,Atendimento', (dd.destinos || []).map((x) => x[1]).join(','));
const ds = (await pedir(sarah, '/api/radio')).j;
cobra('a Sarah fala com: Todos, Karen, Cozinha, Atendimento', (ds.destinos || []).map((x) => x[1]).join(',') === 'Todos,Karen,Cozinha,Atendimento', (ds.destinos || []).map((x) => x[1]).join(','));
cobra('o botão do rádio está em todas as telas: dona, gerente e atendimento',
  (await dona.locator('[data-radio-botao]').count()) === 1 && (await sarah.locator('[data-radio-botao]').count()) === 1 && (await joao.locator('[data-radio-botao]').count()) === 1);

// ---------------------------------------------------------------------------
console.log('\n### SEGURA, FALA, SOLTA');
await dona.locator('[data-radio-botao]').click();
await dona.waitForTimeout(800);
cobra('o painel abre com "Segura pra falar"', /Segura pra falar/.test(limpa(await dona.locator('[data-radio-painel]').innerText())));
await dona.locator('[data-radio-para="gerente"]').click();
const bt = dona.locator('[data-radio-falar]');
const caixa = await bt.boundingBox();
await dona.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
await dona.mouse.down();
await dona.waitForTimeout(800);
// Lido por dentro da página: com o dedo segurando o botão, o Playwright
// espera o botão "soltar" antes de ler por fora.
const durante = limpa(await dona.evaluate(() => document.querySelector('[data-radio-falar]').innerText));
cobra('enquanto segura, o botão diz "Solta pra mandar"', /Solta pra mandar/.test(durante), durante);
await dona.waitForTimeout(1200);
await dona.mouse.up();
await dona.waitForTimeout(2500);
const msgDona = limpa(await dona.locator('[data-radio-msg]').innerText().catch(() => ''));
// No laboratório nenhum celular tem aviso ligado — e a tela diz isso, em vez
// de fingir que alguém ouviu.
cobra('ao soltar, o recado foi guardado pra Sarah — e a tela é honesta sobre os avisos', /Guardado pra Sarah ✓/.test(msgDona) && /nenhum celular/.test(msgDona), msgDona);
const noBanco = (await recadosNoBanco()).map((x) => x.valor).filter((x) => x.de === 'dona' && x.para === 'gerente');
const rec = noBanco[0] || {};
cobra('no banco: de Karen pra Sarah', noBanco.length === 1 && rec.deNome === 'Karen' && rec.paraNome === 'Sarah', JSON.stringify({ de: rec.deNome, para: rec.paraNome }));
const wav = Buffer.from(rec.audio || '', 'base64');
cobra('o áudio é um WAV de verdade, 16 mil por segundo, uma voz só',
  wav.toString('ascii', 0, 4) === 'RIFF' && wav.toString('ascii', 8, 12) === 'WAVE' && wav.readUInt32LE(24) === 16000 && wav.readUInt16LE(22) === 1,
  `${wav.toString('ascii', 0, 4)} ${wav.length ? wav.readUInt32LE(24) : 0} Hz`);
cobra('com uns 2 segundos (o tempo que ela segurou)', rec.segundos >= 1.4 && rec.segundos <= 2.8, String(rec.segundos));
// O bipe de mentira tem som: o WAV não pode ser só silêncio.
const amostras = []; for (let i = 44; i < Math.min(wav.length, 44 + 32000); i += 2) amostras.push(Math.abs(wav.readInt16LE(i)));
cobra('e tem som gravado, não silêncio', Math.max(...amostras) > 500, `pico ${Math.max(...amostras)}`);
cobra('a Karen não vê o próprio recado como "novo"', !(await dona.locator(`[data-radio-recado="${rec.id}"]`).innerText()).includes('novo'));

console.log('\n### UM TOQUE SEM QUERER NÃO VIRA RECADO');
await dona.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
await dona.mouse.down(); await dona.waitForTimeout(150); await dona.mouse.up();
await dona.waitForTimeout(1500);
const msgCurto = limpa(await dona.locator('[data-radio-msg]').innerText().catch(() => ''));
cobra('toque rapidinho: não manda, e explica', /rapidinho|curtinho|Microfone liberado/i.test(msgCurto) && (await recadosNoBanco()).filter((x) => x.valor.de === 'dona' && x.valor.id !== velhoId).length === 1, msgCurto);

// ---------------------------------------------------------------------------
console.log('\n### A SARAH OUVE SEM TOCAR EM NADA');
// O que o service worker faz quando chega a notificação, aqui feito na mão.
await sarah.evaluate((id) => window.dispatchEvent(new CustomEvent('picoos-radio', { detail: { id } })), rec.id);
await sarah.waitForTimeout(700);
const tarja = limpa(await sarah.locator('[data-radio-tarja]').innerText().catch(() => ''));
cobra('aparece a tarja "Karen falando — pra Sarah"', /Karen falando/.test(tarja) && /pra Sarah/.test(tarja), tarja.replace(/\s+/g, ' '));
await sarah.waitForTimeout(3200);
const tocou = await sarah.evaluate(() => window.__tocou);
cobra('o recado tocou sozinho, inteiro (o aparelho leu o WAV)', tocou.length === 1 && Math.abs(tocou[0].dur - rec.segundos) < 0.3, JSON.stringify(tocou.map((x) => x.dur)));
cobra('quando acaba, a tarja some', (await sarah.locator('[data-radio-tarja]').count()) === 0);
cobra('e fica marcado como ouvido', (await sarah.evaluate(() => JSON.parse(localStorage.getItem('picoos-radio-ouvidos') || '[]'))).includes(rec.id));

console.log('\n### O ATENDIMENTO NÃO OUVE O QUE ERA PRA SARAH');
cobra('pedindo o áudio direto: não existe pra ele', (await pedir(joao, `/api/radio?id=${rec.id}`)).status === 404);
cobra('e não aparece na lista dele', !((await pedir(joao, '/api/radio')).j.recados || []).some((x) => x.id === rec.id));
await joao.evaluate((id) => window.dispatchEvent(new CustomEvent('picoos-radio', { detail: { id } })), rec.id);
await joao.waitForTimeout(1500);
cobra('nem toca, se o aviso chegar por engano', (await joao.evaluate(() => window.__tocou.length)) === 0);

console.log('\n### PRA TODOS');
const pt = await pedir(joao, '/api/radio', { para: 'todos', audio: wavDeTeste(1.2), segundos: 1.2 });
cobra('o atendimento manda pra todos', pt.status === 200 && pt.j.ok, JSON.stringify(pt.j).slice(0, 120));
const listaSarah = (await pedir(sarah, '/api/radio')).j.recados || [];
const listaDona = (await pedir(dona, '/api/radio')).j.recados || [];
cobra('a Sarah recebe', listaSarah.some((x) => x.id === pt.j.id && x.deNome === 'Atendimento'));
cobra('a Karen recebe', listaDona.some((x) => x.id === pt.j.id));
await sarah.reload({ waitUntil: 'domcontentloaded' });
await sarah.waitForTimeout(3500);
const bolinha = limpa(await sarah.locator('[data-radio-novos]').innerText().catch(() => ''));
cobra('no celular da Sarah, a bolinha diz 1 recado novo', bolinha === '1', bolinha || '(sem bolinha)');

console.log('\n### O APARELHO NÃO DEIXOU TOCAR SOZINHO');
const sarah2 = await novo({ bloquear: true });
await entrar(sarah2, 'gerente', 'Sarah@2026');
await sarah2.evaluate((id) => window.dispatchEvent(new CustomEvent('picoos-radio', { detail: { id } })), pt.j.id);
await sarah2.waitForTimeout(1500);
const t2 = limpa(await sarah2.locator('[data-radio-tarja]').innerText().catch(() => ''));
cobra('a tarja vira "Recado de Atendimento" com o botão Ouvir', /Recado de Atendimento/.test(t2) && (await sarah2.locator('[data-radio-ouvir]').count()) === 1, t2.replace(/\s+/g, ' '));

console.log('\n### ABRIU PELA NOTIFICAÇÃO');
await sarah.goto(`${BASE}/?radio=${pt.j.id}`, { waitUntil: 'domcontentloaded' });
await sarah.waitForTimeout(4500);
cobra('o recado da notificação toca ao abrir', (await sarah.evaluate(() => window.__tocou.length)) >= 1);
cobra('e o endereço fica limpo de novo', !(sarah.url().includes('radio=')), sarah.url());

console.log('\n### O SERVIDOR NÃO ACEITA QUALQUER COISA');
cobra('áudio que não é WAV: recusa', (await pedir(dona, '/api/radio', { para: 'todos', audio: Buffer.from('<script>alert(1)</script>').toString('base64'), segundos: 1 })).status === 400);
cobra('recado de 0,1 segundo: recusa', (await pedir(dona, '/api/radio', { para: 'todos', audio: wavDeTeste(0.1), segundos: 0.1 })).status === 400);
cobra('falar com ela mesma: recusa', (await pedir(dona, '/api/radio', { para: 'dona', audio: wavDeTeste(), segundos: 1 })).status === 400);
cobra('destino que não existe: recusa', (await pedir(dona, '/api/radio', { para: 'vizinho', audio: wavDeTeste(), segundos: 1 })).status === 400);
cobra('áudio gigante: recusa', (await pedir(dona, '/api/radio', { para: 'todos', audio: 'UklGR' + 'A'.repeat(1000 * 1024), segundos: 10 })).status === 400);

console.log('\n### RECADO VELHO SOME');
cobra('o recado de dois dias atrás foi apagado do banco', !(await recadosNoBanco()).some((x) => x.chave.endsWith(velhoId)));
cobra('e não aparece em lista nenhuma', !((await pedir(dona, '/api/radio')).j.recados || []).some((x) => x.id === velhoId));

console.log('\n### GERENTE FECHADA SAI DA LISTA');
await pedir(dona, '/api/acessos', { acao: 'fechar', papel: 'gerente' });
const dd2 = (await pedir(dona, '/api/radio')).j;
cobra('com o acesso da gerente fechado, a Sarah some dos destinos', !(dd2.destinos || []).some((x) => x[0] === 'gerente'), (dd2.destinos || []).map((x) => x[1]).join(','));

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
