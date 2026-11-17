// LAB_ENV: ANTHROPIC_API_KEY=chave-de-mentira-do-laboratorio
//
// "QUERO QUE O DARCI SAIBA FALAR TODAS AS MINHAS DESPESAS, TIPO O BOTÃO DE
// PROCURAR, MAS POSSO PERGUNTAR: DARCI, QUANTO PAGUEI DE PRÓ-LABORA NOS
// ÚLTIMOS 90 DIAS."
//
// A linha lá em cima pede uma chave de IA de mentira, só pra o Darci aparecer
// na tela do laboratório. Nenhuma pergunta daqui chega na IA — e esse é um dos
// pontos do teste.
//
// O QUE ESTE TESTE GUARDA:
//
//   - O DARCI E O BOTÃO DE PROCURAR DÃO O MESMO NÚMERO. É a mesma busca por
//     baixo; se cada um somasse do seu jeito, ela não saberia em qual confiar.
//   - PERGUNTA NÃO VIRA LANÇAMENTO. A frase tem "paguei" e tem "90": o Darci
//     de antes oferecia LANÇAR uma despesa de R$ 90. Quem pergunta um número
//     não pode sair com um lançamento novo no financeiro.
//   - A FALA É PERDOADA. Ela escreveu "pró labora"; no banco está "Pró-labore
//     (sócios)". Uma letra no fim não pode separar a resposta do "não achei".
//   - O PERÍODO É O QUE ELA DISSE — 90 dias, este mês, mês passado — e, quando
//     ela não diz, ele avisa qual usou.
//   - NÃO INVENTA. Palavra que não existe nas despesas recebe "não achei".
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const painel = async () => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}painel`)).json())[0]?.valor || {};
const gravar = (v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}painel`, valor: v }]) });
// brl() escreve espaço DURO (U+00A0). Com o espaço do teclado não acha nada.
const limpa = (s) => String(s || '').replace(/ /g, ' ');
const hojeBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const menos = (n) => { const d = new Date(`${hojeBR()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// Datas amarradas na janela, não no calendário: assim passa em qualquer mês.
const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  despesas: [
    // Pró-labore: 3 × 1.500 dentro dos 90 dias; 2 × 1.000 nos 90 anteriores.
    { id: 'pl1', data: menos(5), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1500', obs: '' },
    { id: 'pl2', data: menos(35), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1500', obs: '' },
    { id: 'pl3', data: menos(65), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1500', obs: '' },
    { id: 'pl4', data: menos(100), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1000', obs: '' },
    { id: 'pl5', data: menos(140), categoria: 'Pró-labore (sócios)', descricao: 'Karen', valor: '1000', obs: '' },
    // Claude: em duas categorias, e um deles só na observação.
    { id: 'cl1', data: menos(10), categoria: 'Assinaturas', descricao: 'Claude', valor: '120', obs: '' },
    { id: 'cl2', data: menos(40), categoria: 'Assinaturas', descricao: 'claude code', valor: '120', obs: '' },
    { id: 'cl3', data: menos(70), categoria: 'Sistemas', descricao: 'Anthropic', valor: '100', obs: 'assinatura do Claude' },
    { id: 'lz1', data: menos(14), categoria: 'Energia elétrica', descricao: 'Celesc', valor: '430', obs: '' },
  ],
  receitas: [], compras: [], estoque: [], cardapio: [], fichas: [], diario: [], clientes: [],
});
const nDespesasAntes = ((await painel()).despesas || []).length;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const pg = await ctx.newPage();
pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
// Nenhuma pergunta de despesa pode sair pra IA: a conta é exata e é feita aqui.
const idasPraIA = [];
// Só conta o que leva uma PERGUNTA ou um TEXTO dela. A tela do Darci faz
// sozinha uma checagem ("a IA está ligada?") ao abrir, que não é pergunta.
pg.on('request', (r) => {
  if (!/\/api\/darci\/(perguntar|ordem)/.test(r.url())) return;
  const corpo = r.postData() || '';
  if (/"pergunta"|"texto"/.test(corpo)) idasPraIA.push(corpo.slice(0, 80));
});

await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
await pg.waitForTimeout(1800);
await pg.locator('button:text-is("Karen")').first().click();
await pg.locator('input[type="password"]').first().fill('Teste@123');
await pg.locator('button:has-text("Entrar")').first().click();
await pg.waitForTimeout(4200);

const tocar = (rot) => pg.evaluate((r) => {
  const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
  const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
  if (x) { x.click(); return true; }
  return false;
}, rot);
const texto = async () => limpa(await pg.locator('body').innerText());
// Faz a pergunta e devolve só o que apareceu DEPOIS dela na conversa — a
// pergunta em si também tem "90" e "pró-labore", e não pode contar como resposta.
const perguntar = async (q) => {
  const campo = pg.locator('input[placeholder^="Pergunta ou manda anotar"]').first();
  await campo.fill(q);
  await campo.press('Enter');
  await pg.waitForTimeout(2200);
  const t = await texto();
  const i = t.lastIndexOf(q);
  return i < 0 ? t : t.slice(i + q.length);
};

console.log('\n### O DARCI ESTÁ NA TELA');
cobra('abriu o Darci', await tocar('Darci'));
await pg.waitForTimeout(1800);
cobra('tem o campo de perguntar', (await pg.locator('input[placeholder^="Pergunta ou manda anotar"]').count()) > 0);

console.log('\n### A PERGUNTA DELA, DO JEITO QUE ELA ESCREVEU');
// "pró labora", com A no fim: no banco está "Pró-labore (sócios)".
let r = await perguntar('Darci quanto paguei de pró labora nos últimos 90 dias');
// 3 × 1.500. Os dois de 1.000 ficaram fora dos 90 dias.
cobra('responde R$ 4.500,00', /R\$ 4\.500,00/.test(r), r.replace(/\s+/g, ' ').slice(0, 260));
cobra('em 3 lançamentos', /3 lançamentos/.test(r), r.replace(/\s+/g, ' ').slice(0, 200));
cobra('fala nos últimos 90 dias', /últimos 90 dias/i.test(r), r.replace(/\s+/g, ' ').slice(0, 200));
cobra('chama a despesa pelo nome do cadastro', /Pró-labore \(sócios\)/.test(r), r.replace(/\s+/g, ' ').slice(0, 200));
cobra('diz quanto dá por mês: R$ 1.500,00', /R\$ 1\.500,00 por mês/.test(r), r.replace(/\s+/g, ' ').slice(0, 260));
// Os 90 dias anteriores somam 2.000: de 2.000 pra 4.500 é +125%.
cobra('e compara com os 90 dias de antes: subiu 125%', /R\$ 2\.000,00/.test(r) && /subiu 125%/.test(r), r.replace(/\s+/g, ' ').slice(0, 320));

console.log('\n### PERGUNTA NÃO VIRA LANÇAMENTO');
// O "90" solto na frase, com "paguei" do lado, parecia uma despesa de R$ 90.
cobra('não ofereceu lançar despesa nenhuma', !/lançar despesa|confirmar|R\$ 90,00/i.test(r), (r.match(/[^\n]*(lançar despesa|confirmar|R\$ 90,00)[^\n]*/i) || ['(não ofereceu, certo)'])[0]);
await pg.waitForTimeout(2600);
cobra('e nenhuma despesa nova nasceu no banco', ((await painel()).despesas || []).length === nDespesasAntes, `${nDespesasAntes} -> ${((await painel()).despesas || []).length}`);

console.log('\n### PALAVRA-CHAVE: "CLAUDE"');
r = await perguntar('quanto gastei com claude nos últimos 90 dias?');
// 120 + 120 + 100, sendo que um deles só tem a palavra na observação.
cobra('soma R$ 340,00', /R\$ 340,00/.test(r), r.replace(/\s+/g, ' ').slice(0, 260));
cobra('diz que está em 2 categorias', /2 categorias/.test(r) && /Assinaturas/.test(r) && /Sistemas/.test(r), r.replace(/\s+/g, ' ').slice(0, 300));
cobra('e não mistura a conta de luz', !/Energia|Celesc|R\$ 770,00/.test(r), r.replace(/\s+/g, ' ').slice(0, 200));

console.log('\n### O PERÍODO É O QUE ELA DISSE');
r = await perguntar('quanto paguei de pro labore nos últimos 30 dias');
cobra('em 30 dias: só R$ 1.500,00', /R\$ 1\.500,00/.test(r) && !/R\$ 4\.500,00/.test(r), r.replace(/\s+/g, ' ').slice(0, 220));
r = await perguntar('quanto paguei de pro labore nos últimos 6 meses');
// 180 dias pegam os cinco: 4.500 + 2.000.
cobra('em 6 meses: R$ 6.500,00, em 5 lançamentos', /R\$ 6\.500,00/.test(r) && /5 lançamentos/.test(r), r.replace(/\s+/g, ' ').slice(0, 220));
r = await perguntar('quanto gastei de energia elétrica');
// Sem período na frase: ele usa 90 dias e DIZ que usou.
cobra('sem período, usa 90 dias e avisa', /R\$ 430,00/.test(r) && /Olhei os últimos 90 dias/.test(r), r.replace(/\s+/g, ' ').slice(0, 260));

console.log('\n### NÃO INVENTA');
r = await perguntar('quanto gastei com helicóptero nos últimos 90 dias');
cobra('palavra que não existe recebe "não achei"', /Não achei nenhuma despesa com "helicoptero"/i.test(r), r.replace(/\s+/g, ' ').slice(0, 200));
cobra('e não solta número nenhum', !/R\$ \d/.test(r), r.replace(/\s+/g, ' ').slice(0, 200));

console.log('\n### A CONTA É FEITA AQUI, NÃO NA IA');
cobra('nenhuma dessas perguntas foi mandada pra IA', idasPraIA.length === 0, idasPraIA.join(' | ') || '(zero idas, certo)');

console.log('\n### E É O MESMO NÚMERO DO BOTÃO DE PROCURAR');
cobra('abriu Finanças', await tocar('Finanças'));
await pg.waitForTimeout(1400);
cobra('abriu Despesas', await tocar('Despesas'));
await pg.waitForTimeout(1200);
cobra('abriu Procurar', await tocar('Procurar'));
await pg.waitForTimeout(900);
await pg.evaluate(() => {
  const campo = [...document.querySelectorAll('input')].find((i) => /procurar/i.test(i.placeholder || ''));
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(campo, 'pro labore');
  campo.dispatchEvent(new Event('input', { bubbles: true }));
});
await pg.waitForTimeout(900);
const tela = await texto();
const iBloco = tela.search(/"[^"]+"\s*·/);
const bloco = iBloco < 0 ? '' : tela.slice(iBloco, iBloco + 260);
cobra('a tela de procurar também diz R$ 4.500,00 em 3 lançamentos', /R\$ 4\.500,00/.test(bloco) && /3 lançamentos/.test(bloco), bloco.replace(/\s+/g, ' ').slice(0, 200) || '(sem bloco)');

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
