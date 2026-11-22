// "QUERO QUE O PicoOS SEJA UM SISTEMA QUE DÁ PRA INSTALAR... ALGO QUE NÃO
// DEPENDA DE MIM: A PESSOA VIU, QUIS, INSTALOU E ASSINOU."
//
// O QUE ESTE TESTE GUARDA:
//   - O CAMINHO INTEIRO SEM A KAREN: página de apresentação -> "Criar meu bar"
//     -> formulário -> já entra no app dela, com o código na tela e 14 dias.
//   - O BAR NOVO NASCE VAZIO: não enxerga nada do Pico do Mané.
//   - O CÓDIGO SAI DO NOME, e o segundo "Boteco da Ana" vira boteco-da-ana-2.
//   - ROBÔ NÃO ENCHE O BANCO: campo-armadilha e limite por rede.
//   - ASSINAR: CPF errado é recusado em português; certo cria a assinatura
//     no Asaas (de mentira, aqui) com o preço da sala de máquinas, e devolve
//     o link do pagamento.
//   - O AVISO DO ASAAS: sem a senha do aviso, nada; com ela, libera UM mês —
//     e o mesmo aviso repetido não libera dois.
//   - VENCEU: a dona vê a tela de pagar, a equipe vê "fala com a dona", e os
//     pedidos de dados são recusados. Atrasado (carência): funciona com aviso.
//   - O PICO DO MANÉ É ISENTO: nunca vê aviso, nunca fecha, e nem um toque
//     errado na sala de máquinas põe ele na cobrança.
//   - A SALA DE MÁQUINAS: preço, cadastro aberto/fechado, +dias.
//
// LAB_ENV: ADMIN_PASSWORD=Admin@123
// LAB_ENV: ASAAS_API_KEY=chave-falsa-do-lab
// LAB_ENV: ASAAS_URL=http://127.0.0.1:54400
// LAB_ENV: ASAAS_WEBHOOK_TOKEN=senha-do-aviso
// LAB_ENV: LISTA_CACHE_MS=0
// LAB_ENV: ANTHROPIC_API_KEY=chave-de-mentira
// LAB_ENV: ANTHROPIC_BASE_URL=http://127.0.0.1:9
import http from 'http';
import { readFileSync } from 'fs';
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linhaCrua = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${encodeURIComponent(chave)}`)).json())[0]?.valor;
const gravarCrua = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ chave, valor: v }]) });
const DIA = 86400000;

// A conta, direto da biblioteca (sem banco).
const lib = await import('data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('../lib/assinatura.js', import.meta.url))).toString('base64'));

console.log('\n— a conta da assinatura —');
cobra('31/jan + 1 mês = 28/fev (não 03/mar)', new Date(lib.maisUmMes(Date.UTC(2027, 0, 31))).toISOString().slice(0, 10) === '2027-02-28');
cobra('"Bar do Zé" vira bar-do-ze', lib.codigoDoNome('Bar do Zé') === 'bar-do-ze', lib.codigoDoNome('Bar do Zé'));
cobra('CPF válido passa, inválido não', lib.documentoValido('529.982.247-25') === '52998224725' && lib.documentoValido('123.456.789-00') === null);
cobra('CNPJ válido passa', lib.documentoValido('11.222.333/0001-81') === '11222333000181');
cobra('sem assinatura = isento (o Pico nunca fecha)', lib.situacao({ nome: 'Pico' }).estado === 'isento' && lib.situacao({ nome: 'Pico' }).podeUsar);
const ag = Date.now();
cobra('teste vencido há 2 dias = atrasado, ainda abre', (() => { const s = lib.situacao({ assinatura: { plano: 'teste', testeAte: new Date(ag - 2 * DIA).toISOString() } }, ag); return s.estado === 'atrasado' && s.podeUsar && s.dias === 3; })());
cobra('teste vencido há 6 dias = bloqueado', lib.situacao({ assinatura: { plano: 'teste', testeAte: new Date(ag - 6 * DIA).toISOString() } }, ag).estado === 'bloqueado');
{
  const a0 = { plano: 'teste', testeAte: new Date(ag + 11 * DIA).toISOString(), pagamentos: [] };
  const r1 = lib.creditarPagamento(a0, 'p1', ag);
  const r2 = lib.creditarPagamento(r1.assinatura, 'p1', ag);
  cobra('pagou no 3º dia: o mês conta do fim do teste (não perde os 11 dias)', r1.assinatura.pagoAte === new Date(lib.maisUmMes(ag + 11 * DIA)).toISOString());
  cobra('o mesmo pagamento duas vezes libera UM mês só', r2.creditou === false && r2.assinatura.pagoAte === r1.assinatura.pagoAte);
}

// ---------- O ASAAS DE MENTIRA ----------
const asaas = { pedidos: [], assinaturas: {}, cobrancas: [] };
const diaSP = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(ms));
const srv = http.createServer((req, res) => {
  let corpo = '';
  req.on('data', (c) => { corpo += c; });
  req.on('end', () => {
    const j = corpo ? JSON.parse(corpo) : null;
    asaas.pedidos.push({ metodo: req.method, url: req.url, corpo: j, chave: req.headers.access_token });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && req.url === '/customers') return res.end(JSON.stringify({ id: 'cus_lab1' }));
    if (req.method === 'POST' && req.url === '/subscriptions') {
      asaas.assinaturas.sub_lab1 = j;
      asaas.cobrancas = [{ id: 'pay_lab1', status: 'PENDING', dueDate: j.nextDueDate, value: j.value, invoiceUrl: 'https://sandbox.asaas.com/i/pay_lab1' }];
      return res.end(JSON.stringify({ id: 'sub_lab1' }));
    }
    if (req.method === 'GET' && req.url.startsWith('/subscriptions/sub_lab1/payments')) {
      // asaas.cobrancas: o que o Asaas tem em aberto pra esta assinatura.
      const st = /status=(\w+)/.exec(req.url)[1];
      return res.end(JSON.stringify({ data: asaas.cobrancas.filter((c) => c.status === st) }));
    }
    if (req.method === 'DELETE' && req.url === '/subscriptions/sub_lab1') return res.end(JSON.stringify({ deleted: true, id: 'sub_lab1' }));
    res.statusCode = 404; res.end(JSON.stringify({ errors: [{ description: 'não achei' }] }));
  });
});
await new Promise((ok) => srv.listen(54400, '127.0.0.1', ok));

// O app de muitos, como em produção: o Pico do Mané está na lista, SEM
// assinatura (isento).
await gravarCrua('adm:negocios', { 'pico-do-mane': { nome: 'Pico do Mané', ativo: true, criadoEm: '2026-01-01T00:00:00.000Z' } });

const cookieDe = (r) => (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]).filter(Boolean).map((c) => c.split(';')[0]).join('; ');
async function entrar(codigo, papel, senha, nome) {
  const r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, papel, senha, nome, lembrar: true }) });
  return { ok: r.ok, cookie: cookieDe(r) };
}
const api = async (caminho, cookie, corpo, metodo) => {
  const r = await fetch(BASE + caminho, { method: metodo || (corpo ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', cookie: cookie || '' }, body: corpo ? JSON.stringify(corpo) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};

const browser = await chromium.launch();
const iphone = { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };

console.log('\n— o caminho inteiro, do QR code até dentro do app —');
const ctx = await browser.newContext({ ...iphone, extraHTTPHeaders: { 'x-forwarded-for': '10.1.1.1' } });
const pg = await ctx.newPage();
await pg.goto(`${BASE}/conheca`);
const btn = pg.locator('[data-criar-bar]');
cobra('a página de apresentação tem o botão "Criar meu negócio grátis"', await btn.count() === 1 && /Criar meu negócio grátis/.test(await btn.innerText()));
cobra('e mostra o preço da sala de máquinas (R$ 99,90)', /R\$\s?99,90\/mês/.test(await pg.locator('body').innerText()));
await btn.click();
await pg.waitForURL(/\/criar$/);
await pg.waitForSelector('[data-form-cadastro]');
const textoForm = await pg.locator('main').first().innerText();
cobra('a tela de criar fala em "negócio" (e não mais em "bar")', /CRIAR MEU NEGÓCIO/.test(textoForm) && /Nome do negócio/i.test(textoForm) && /Criar meu negócio/.test(textoForm) && !/Nome do bar/i.test(textoForm), textoForm.slice(0, 120).replace(/\n/g, ' | '));
const campos = pg.locator('[data-form-cadastro] input:visible');
const preencher = async (vals) => { for (let i = 0; i < vals.length; i += 1) await campos.nth(i).fill(vals[i]); };
await preencher(['Boteco da Ana', 'Palhoça', 'Ana Souza', '(48) 99123-4567', 'ana@boteco.com', 'Ana@2026', 'Ana@2026']);
await pg.click('button[type=submit]');
await pg.waitForSelector('[data-erro-cadastro]');
cobra('sem marcar o "entendi" não cria', /concordas/.test(await pg.locator('[data-erro-cadastro]').innerText()));
await pg.check('[data-aceite]');
await pg.click('button[type=submit]');
await pg.waitForSelector('[data-cadastro-pronto]', { timeout: 15000 });
const codigoNaTela = (await pg.locator('[data-codigo]').innerText()).trim();
cobra('o código do bar aparece na tela: boteco-da-ana', codigoNaTela === 'boteco-da-ana', codigoNaTela);
cobra('a instrução de instalar é a do iPhone (Safari)', /Adicionar à Tela de Início/.test(await pg.locator('[data-cadastro-pronto]').innerText()));

const lista1 = await linhaCrua('adm:negocios');
const ana = lista1['boteco-da-ana'];
const dTeste = ana && (Date.parse(ana.assinatura.testeAte) - Date.now()) / DIA;
cobra('na lista: teste de 14 dias', ana && ana.assinatura.plano === 'teste' && dTeste > 13.9 && dTeste <= 14.01, dTeste && dTeste.toFixed(2));
cobra('o contato ficou guardado (WhatsApp com 55)', ana && ana.contato.whatsapp === '5548991234567' && ana.contato.nome === 'Ana Souza');
const painelAna = await linhaCrua('n:boteco-da-ana:painel');
cobra('o app já nasce com o nome do bar e da dona', painelAna && painelAna.negocio.nome === 'Boteco da Ana' && painelAna.negocio.dona === 'Ana Souza');
cobra('a senha foi guardada embaralhada, nunca em texto', !JSON.stringify(await linhaCrua('n:boteco-da-ana:authDona') || '').includes('Ana@2026'));

await pg.click('text=Entrar no meu PicoOS');
await pg.waitForSelector('[data-aviso-assinatura]', { timeout: 20000 });
cobra('já entra logada, com a faixa "Faltam 14 dias do teu teste grátis"', /Faltam 14 dias/.test(await pg.locator('[data-aviso-assinatura]').innerText()));
const cookieAna = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
const dadosAna = await api('/api/data', cookieAna);
const txtAna = JSON.stringify(dadosAna.j);
cobra('o bar novo NÃO enxerga nada do Pico do Mané', dadosAna.status === 200 && !/Heineken|Pico do Man/.test(txtAna), String(dadosAna.status));

console.log('\n— o Darci é só do bar da casa —');
// "O Darci vai ter somente no meu bar." Cada pergunta é IA paga pela chave da Karen.
cobra('o bar novo não tem o Darci na tela', (await api('/api/recursos', cookieAna)).j.darci === false);
cobra('nem pelo endereço direto (pergunta, relatório, voz)', (await api('/api/darci/perguntar', cookieAna, { pergunta: 'oi' })).status === 403
  && (await api('/api/darci/relatorio?semana=passada', cookieAna)).status === 403 && (await api('/api/darci/prefs', cookieAna)).status === 403);

console.log('\n— robôs e cadastro repetido —');
const cad = (corpo, ip) => fetch(`${BASE}/api/cadastro`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ nomeBar: 'Boteco da Ana', cidade: 'X', dona: 'Outra Ana', whatsapp: '48988887777', senha: 'Senha@123', aceite: true, ...corpo }) }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const dois = await cad({}, '10.2.2.2');
cobra('o segundo "Boteco da Ana" vira boteco-da-ana-2', dois.j.codigo === 'boteco-da-ana-2', JSON.stringify(dois.j));
const robo = await cad({ site: 'http://spam' }, '10.3.3.3');
cobra('o campo-armadilha preenchido não cria nada', !robo.j.ok && !(await linhaCrua('adm:negocios'))['boteco-da-ana-3']);
const rajada = [];
for (let i = 0; i < 4; i += 1) rajada.push(await cad({ nomeBar: `Rajada ${i}` }, '10.9.9.9'));
cobra('da mesma rede: 3 cadastros por dia, o 4º é recusado', rajada.slice(0, 3).every((r) => r.j.ok) && rajada[3].status === 429, rajada.map((r) => r.status).join(','));

console.log('\n— assinar —');
await pg.goto(BASE);
await pg.click('[data-aviso-assinatura] button');
await pg.waitForSelector('[data-assinatura]');
const cAss = pg.locator('[data-assinatura] input');
cobra('o nome da cobrança já vem preenchido com o da dona', (await cAss.nth(0).inputValue()) === 'Ana Souza');
await cAss.nth(1).fill('123.456.789-00');
await pg.click('[data-assinatura] button:has-text("Assinar")');
await pg.waitForSelector('[data-assinatura] >> text=/CPF ou CNPJ/');
cobra('CPF errado: recusado em português, sem ir ao Asaas', asaas.pedidos.length === 0);
await cAss.nth(1).fill('529.982.247-25');
await pg.click('[data-assinatura] button:has-text("Assinar")');
await pg.waitForSelector('a:has-text("Abrir a página de pagamento")', { timeout: 15000 });
const href = await pg.locator('a:has-text("Abrir a página de pagamento")').getAttribute('href');
cobra('devolve o link do pagamento do Asaas (botão-link, funciona no iPhone)', href === 'https://sandbox.asaas.com/i/pay_lab1', href);
const sub = asaas.assinaturas.sub_lab1 || {};
const hojeSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
cobra('a assinatura no Asaas: R$ 99,90, mensal, cliente escolhe Pix/boleto/cartão', sub.value === 99.9 && sub.cycle === 'MONTHLY' && sub.billingType === 'UNDEFINED' && sub.nextDueDate === hojeSP && sub.externalReference === 'boteco-da-ana', JSON.stringify(sub));
cobra('a chave do Asaas vai no cabeçalho, do servidor', asaas.pedidos.every((p) => p.chave === 'chave-falsa-do-lab'));
const cli = asaas.pedidos.find((p) => p.url === '/customers');
cobra('o cliente no Asaas leva CPF, e-mail e celular sem o 55', cli && cli.corpo.cpfCnpj === '52998224725' && cli.corpo.email === 'ana@boteco.com' && cli.corpo.mobilePhone === '48991234567', JSON.stringify(cli && cli.corpo));
const regAna = (await linhaCrua('adm:negocios'))['boteco-da-ana'].assinatura;
cobra('o bar guardou o número da assinatura', regAna.asaasAssinatura === 'sub_lab1' && regAna.asaasCliente === 'cus_lab1');

console.log('\n— o aviso de pagamento do Asaas —');
const aviso = (token, corpo) => fetch(`${BASE}/api/assinatura/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'asaas-access-token': token } : {}) }, body: JSON.stringify(corpo) }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) }));
const pago = { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_lab1', subscription: 'sub_lab1', value: 99.9, externalReference: 'boteco-da-ana' } };
cobra('sem a senha do aviso: recusado', (await aviso(null, pago)).status === 401);
cobra('com senha errada: recusado', (await aviso('chute', pago)).status === 401);
cobra('ninguém liberou nada até aqui', !(await linhaCrua('adm:negocios'))['boteco-da-ana'].assinatura.pagoAte);
const r1 = await aviso('senha-do-aviso', pago);
const a1 = (await linhaCrua('adm:negocios'))['boteco-da-ana'].assinatura;
const esperado = new Date(lib.maisUmMes(Date.parse(regAna.testeAte))).toISOString();
cobra('com a senha certa: libera um mês, contado do fim do teste', r1.j.creditou === true && a1.pagoAte === esperado && a1.plano === 'pago', `${a1.pagoAte} vs ${esperado}`);
const r2 = await aviso('senha-do-aviso', pago);
cobra('o MESMO aviso de novo não libera outro mês', r2.j.creditou === false && (await linhaCrua('adm:negocios'))['boteco-da-ana'].assinatura.pagoAte === esperado);
const r3 = await aviso('senha-do-aviso', { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_x', subscription: 'sub_de_outro', externalReference: 'boteco-da-ana' } });
cobra('assinatura desconhecida é ignorada (não confia no nome escrito no aviso)', r3.status === 200 && !r3.j.creditou && (await linhaCrua('adm:negocios'))['boteco-da-ana'].assinatura.pagoAte === esperado);
const r4 = await aviso('senha-do-aviso', { event: 'PAYMENT_CREATED', payment: { id: 'pay_y', subscription: 'sub_lab1' } });
cobra('cobrança só CRIADA não libera nada', r4.status === 200 && !r4.j.creditou);

console.log('\n— depois de pagar: a do mês que vem não é dívida —');
// O Asaas já cria a cobrança do mês seguinte uns 40 dias antes. Logo depois de
// pagar, ela aparece "em aberto" — e não pode ser mostrada como atrasada.
asaas.cobrancas = [{ id: 'pay_lab2', status: 'PENDING', dueDate: diaSP(Date.now() + 33 * DIA), value: 99.9, invoiceUrl: 'https://sandbox.asaas.com/i/pay_lab2' }];
const pg2 = await api('/api/assinatura', cookieAna, { acao: 'pagar' });
cobra('"Pagar" logo depois de pagar: "está tudo pago", com a data da próxima', pg2.j.ok && pg2.j.jaPago === true && !pg2.j.link && pg2.j.proxima === diaSP(Date.now() + 33 * DIA), JSON.stringify(pg2.j));
asaas.cobrancas = [{ id: 'pay_lab2', status: 'PENDING', dueDate: diaSP(Date.now() + 4 * DIA), value: 99.9, invoiceUrl: 'https://sandbox.asaas.com/i/pay_lab2' }];
const pg3 = await api('/api/assinatura', cookieAna, { acao: 'pagar' });
cobra('perto do vencimento (4 dias): aí sim mostra o link pra pagar', pg3.j.link === 'https://sandbox.asaas.com/i/pay_lab2', JSON.stringify(pg3.j));
asaas.cobrancas = [
  { id: 'pay_lab3', status: 'PENDING', dueDate: diaSP(Date.now() + 30 * DIA), value: 99.9, invoiceUrl: 'https://sandbox.asaas.com/i/pay_lab3' },
  { id: 'pay_lab2', status: 'OVERDUE', dueDate: diaSP(Date.now() - 3 * DIA), value: 99.9, invoiceUrl: 'https://sandbox.asaas.com/i/pay_lab2' },
];
const pg4 = await api('/api/assinatura', cookieAna, { acao: 'pagar' });
cobra('atrasada: o link é o da atrasada, não o da próxima', pg4.j.link === 'https://sandbox.asaas.com/i/pay_lab2', JSON.stringify(pg4.j));

// A equipe do bar novo é por pessoa: a dona cria o login antes de tudo.
const criouBia = await api('/api/acessos', cookieAna, { acao: 'criarLogin', nome: 'Bia', tipo: 'garcom', senha: 'bia123' });
cobra('a dona cria o login da Bia (Atendimento)', criouBia.j.ok === true, JSON.stringify(criouBia.j));

console.log('\n— venceu: a porta fecha, nada se apaga —');
const mexer = async (codigo, mud) => { const l = await linhaCrua('adm:negocios'); l[codigo] = mud(l[codigo]); await gravarCrua('adm:negocios', l); };
await mexer('boteco-da-ana', (n) => ({ ...n, assinatura: { ...n.assinatura, testeAte: new Date(Date.now() - 50 * DIA).toISOString(), pagoAte: new Date(Date.now() - 2 * DIA).toISOString() } }));
// (A faixa some de propósito DENTRO da tela Assinatura, onde a situação já
// está escrita grande; o app lembra a última tela, então volta pro Dashboard.)
await pg.evaluate(() => localStorage.setItem('picoos-tab', 'hoje'));
await pg.goto(BASE);
await pg.waitForSelector('[data-aviso-assinatura]');
cobra('atrasado 2 dias: o app abre, com faixa vermelha "fecha em 3 dias"', /fecha em 3 dias/.test(await pg.locator('[data-aviso-assinatura]').innerText()));
cobra('atrasado: os dados ainda respondem', (await api('/api/data', cookieAna)).status === 200);
await mexer('boteco-da-ana', (n) => ({ ...n, assinatura: { ...n.assinatura, pagoAte: new Date(Date.now() - 6 * DIA).toISOString() } }));
await pg.goto(BASE);
await pg.waitForSelector('[data-app-pausado]');
const telaDona = await pg.locator('[data-app-pausado]').innerText();
cobra('bloqueado: a dona vê "O app está pausado" e o botão de pagar', /O app está pausado/.test(telaDona) && /Pagar a mensalidade/.test(telaDona) && /Nada foi apagado/.test(telaDona));
const dBloq = await api('/api/data', cookieAna);
cobra('bloqueado: os pedidos de dados são recusados (402)', dBloq.status === 402 && dBloq.j.pausado === 'bloqueado', String(dBloq.status));
cobra('bloqueado: a tela de assinatura continua respondendo', (await api('/api/assinatura', cookieAna)).j.estado === 'bloqueado');
const garcom = await entrar('boteco-da-ana', 'equipe', 'bia123', 'Bia');
cobra('a equipe ainda entra com o nome e a senha dela (pra ver o aviso)', garcom.ok);
const ctxG = await browser.newContext(iphone);
await ctxG.addCookies(garcom.cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE }; }));
const pgG = await ctxG.newPage();
await pgG.goto(BASE);
await pgG.waitForSelector('[data-app-pausado]');
const telaG = await pgG.locator('[data-app-pausado]').innerText();
cobra('a equipe vê "avisa a dona", sem preço nem botão de pagar', /Avisa o dono ou a dona/.test(telaG) && !/R\$|Pagar/.test(telaG));
cobra('a equipe também não puxa dado nenhum (402)', (await api('/api/comandas', garcom.cookie)).status === 402);
cobra('os dados do bar continuam todos lá', !!(await linhaCrua('n:boteco-da-ana:painel')));

console.log('\n— o Pico do Mané é isento —');
// No app de muitos não vale a APP_PASSWORD: a senha da dona mora no banco do
// bar. A sala de máquinas põe uma (é o mesmo botão que a Karen usa).
const cAdm0 = cookieDe(await fetch(`${BASE}/api/admin/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: 'Admin@123' }) }));
await api('/api/admin/negocios', cAdm0, { acao: 'senha', codigo: 'pico-do-mane', senha: 'Pico@2026' });
const pico = await entrar('pico-do-mane', 'dona', 'Pico@2026');
cobra('a dona do Pico entra com o código', pico.ok);
const cPico = pico.cookie;
const sPico = await api('/api/assinatura', cPico);
cobra('a assinatura do Pico responde "isento"', sPico.j.estado === 'isento', JSON.stringify(sPico.j));
cobra('o Pico puxa os dados normalmente', (await api('/api/data', cPico)).status === 200);
cobra('o Pico tem o Darci', (await api('/api/recursos', cPico)).j.darci === true);
cobra('o Pico não consegue "assinar" (não tem cobrança)', (await api('/api/assinatura', cPico, { acao: 'assinar', documento: '52998224725' })).status === 400);
const ctxP = await browser.newContext(iphone);
await ctxP.addCookies(cPico.split('; ').filter(Boolean).map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE }; }));
const pgP = await ctxP.newPage();
await pgP.goto(BASE);
await pgP.waitForTimeout(2500);
cobra('o Pico não vê faixa de assinatura nenhuma', await pgP.locator('[data-aviso-assinatura]').count() === 0 && await pgP.locator('[data-app-pausado]').count() === 0);

console.log('\n— a sala de máquinas —');
const adm = await fetch(`${BASE}/api/admin/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: 'Admin@123' }) });
const cAdm = cookieDe(adm);
const lst = await api('/api/admin/negocios', cAdm);
const nAna = (lst.j.negocios || []).find((n) => n.codigo === 'boteco-da-ana');
const nPico = (lst.j.negocios || []).find((n) => n.codigo === 'pico-do-mane');
cobra('a lista mostra a situação de cada bar', nAna && nAna.situacao.estado === 'bloqueado' && nPico && nPico.situacao.estado === 'isento');
cobra('e não mostra os números do Asaas', !JSON.stringify(lst.j).includes('sub_lab1'));
cobra('"Voltar a cobrar" no Pico é recusado', (await api('/api/admin/negocios', cAdm, { acao: 'cobrar', codigo: 'pico-do-mane' })).status === 400 && !(await linhaCrua('adm:negocios'))['pico-do-mane'].assinatura);
await api('/api/admin/negocios', cAdm, { acao: 'maisDias', codigo: 'boteco-da-ana', dias: 30 });
const depoisDias = lib.situacao((await linhaCrua('adm:negocios'))['boteco-da-ana']);
cobra('+30 dias (pagou por fora) libera o bar na hora', depoisDias.estado === 'em_dia' && depoisDias.dias >= 29, JSON.stringify(depoisDias));
cobra('liberado: os dados voltam a responder', (await api('/api/data', cookieAna)).status === 200);
await api('/api/admin/negocios', cAdm, { acao: 'config', preco: '129,90' });
cobra('preço novo: o cadastro mostra R$ 129,90', (await api('/api/cadastro')).j.preco === 129.9);
const pc = await browser.newPage();
await pc.goto(`${BASE}/conheca`);
cobra('e a página de apresentação também', /R\$\s?129,90\/mês/.test(await pc.locator('body').innerText()));
await api('/api/admin/negocios', cAdm, { acao: 'config', cadastroAberto: false });
cobra('cadastro fechado: ninguém novo entra', (await cad({ nomeBar: 'Fechado' }, '10.4.4.4')).status === 403);
await api('/api/admin/negocios', cAdm, { acao: 'isentar', codigo: 'boteco-da-ana' });
cobra('isentar: o bar deixa de ter cobrança', (await api('/api/assinatura', cookieAna)).j.estado === 'isento');
await api('/api/admin/negocios', cAdm, { acao: 'cobrar', codigo: 'boteco-da-ana' });
cobra('voltar a cobrar: mantém o mês já pago', lib.situacao((await linhaCrua('adm:negocios'))['boteco-da-ana']).estado === 'em_dia');

console.log('\n— cancelar —');
const canc = await api('/api/assinatura', cookieAna, { acao: 'cancelar' });
cobra('cancelar avisa o Asaas e mantém o app até o fim do mês pago', canc.j.ok && asaas.pedidos.some((p) => p.metodo === 'DELETE' && p.url === '/subscriptions/sub_lab1') && (await linhaCrua('adm:negocios'))['boteco-da-ana'].assinatura.cancelada === true && (await api('/api/data', cookieAna)).status === 200);

await browser.close();
srv.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
