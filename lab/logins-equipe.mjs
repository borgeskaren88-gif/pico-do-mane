// "DENTRO DO SISTEMA PARA OS OUTROS BARES: VAMOS TIRAR O AO VIVO E QUERO QUE
// TODOS TENHAM OPÇÃO DE CRIAR ATÉ 5 LOGINS, COM OS NOMES E SENHAS EDITÁVEIS.
// NÃO PRECISA IR COM TÍTULO DE GERENTE E TAL."
//
// O QUE ESTE TESTE GUARDA:
//   - O PICO FICA COMO ESTÁ: cargos na tela de entrar, 1234 da cozinha e do
//     atendimento, Bar ao vivo no menu.
//   - O BAR NOVO ENTRA POR PESSOA: "Dono(a)" ou "Equipe" + o nome. Os cargos
//     de fábrica (1234) NÃO abrem — senão qualquer um com o código entrava.
//   - ATÉ 5 LOGINS: a dona cria, edita nome/tipo/senha e apaga. O 6º, nome
//     repetido, "dona" e senha curta são recusados em português.
//   - CADA TIPO ABRE A SUA TELA: Atendimento, Cozinha, Gerência (sem Extra).
//   - TROCAR A SENHA OU APAGAR DERRUBA QUEM ESTAVA DENTRO; renomear não.
//   - SENHA SÓ EMBARALHADA, nunca volta pra tela.
//   - SEM BAR AO VIVO no bar novo (nem pelo endereço direto).
//
// LAB_ENV: ADMIN_PASSWORD=Admin@123
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linhaCrua = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${encodeURIComponent(chave)}`)).json())[0]?.valor;
const gravarCrua = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave, valor: v }]) });
const cookieDe = (r) => (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]).filter(Boolean).map((c) => c.split(';')[0]).join('; ');
const entrar = async (codigo, papel, senha, nome) => {
  const r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, papel, senha, nome, lembrar: true }) });
  return { ok: r.ok, cookie: cookieDe(r), j: await r.json().catch(() => ({})) };
};
const api = async (caminho, cookie, corpo) => {
  const r = await fetch(BASE + caminho, { method: corpo ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', cookie: cookie || '' }, body: corpo ? JSON.stringify(corpo) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};

// O app de muitos, como em produção: o Pico na lista. A senha da dona do Pico
// mora no banco dele (a sala de máquinas põe).
await gravarCrua('adm:negocios', { 'pico-do-mane': { nome: 'Pico do Mané', ativo: true, criadoEm: '2026-01-01T00:00:00.000Z' } });
const cAdm = cookieDe(await fetch(`${BASE}/api/admin/entrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: 'Admin@123' }) }));
await api('/api/admin/negocios', cAdm, { acao: 'senha', codigo: 'pico-do-mane', senha: 'Pico@2026' });

// O bar novo, pelo cadastro sozinho.
const cad = await fetch(`${BASE}/api/cadastro`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.7.7.7' }, body: JSON.stringify({ nomeBar: 'Boteco da Ana', cidade: 'Palhoça', dona: 'Ana', whatsapp: '48991234567', senha: 'Ana@2026', aceite: true }) });
const cAna = cookieDe(cad);
cobra('o bar novo foi criado', cad.ok);

console.log('\n— o Pico fica como está —');
const picoGarcom = await entrar('pico-do-mane', 'garcom', '1234');
cobra('o atendimento do Pico ainda entra com 1234', picoGarcom.ok && picoGarcom.j.papel === 'garcom');
const cPico = (await entrar('pico-do-mane', 'dona', 'Pico@2026')).cookie;
const recPico = await api('/api/recursos', cPico);
cobra('o Pico é o bar da casa (Bar ao vivo e cargos)', recPico.j.casa === true);
const acPico = await api('/api/acessos', cPico);
cobra('os Acessos do Pico continuam por cargo (Cozinha, Atendimento, Gerente, Extra)', !acPico.j.modo && (acPico.j.acessos || []).map((a) => a.papel).join(',') === 'cozinha,garcom,reservas,extra,gerente');
cobra('o Pico ainda abre o Bar ao vivo', (await api('/api/aovivo', cPico)).status === 200);

console.log('\n— o bar novo entra por pessoa —');
for (const [papel, senha] of [['garcom', '1234'], ['cozinha', '1234'], ['reservas', '1234'], ['gerente', 'x1234'], ['extra', 'x1234']]) {
  cobra(`o cargo de fábrica "${papel}" não abre o bar novo`, !(await entrar('boteco-da-ana', papel, senha)).ok);
}
const browser = await chromium.launch();
const tela = await browser.newPage({ viewport: { width: 420, height: 900 } });
await tela.goto(BASE);
await tela.waitForSelector('select[data-quem]');
await tela.fill('input[placeholder="ex: boteco-da-ana"]', 'pico-do-mane');
await tela.waitForTimeout(900);
const opcoesPico = await tela.locator('select[data-quem] option').allInnerTexts();
cobra('com o código do Pico, a tela mostra os cargos', opcoesPico.includes('Cozinha') && opcoesPico.includes('Gerente'), opcoesPico.join(','));
await tela.fill('input[placeholder="ex: boteco-da-ana"]', 'boteco-da-ana');
await tela.waitForTimeout(900);
const opcoesNovo = await tela.locator('select[data-quem] option').allInnerTexts();
cobra('com o código do bar novo: só "Dono(a)" e "Equipe"', opcoesNovo.join(',') === 'Dono(a),Equipe', opcoesNovo.join(','));
await tela.selectOption('select[data-quem]', 'equipe');
cobra('escolhendo "Equipe", aparece o campo "Teu nome"', await tela.locator('[data-nome-equipe]').count() === 1);
await tela.fill('input[placeholder="ex: boteco-da-ana"]', 'codigo-que-nao-existe');
await tela.waitForTimeout(900);
cobra('um código inventado recebe a mesma tela (não conta quem é cliente)', (await tela.locator('select[data-quem] option').allInnerTexts()).join(',') === 'Dono(a),Equipe');

console.log('\n— a dona cria até 5 logins —');
// No computador o app sai sozinho em janela que não acabou de entrar
// (SaiSozinho); a marca de "acabei de entrar" vem antes da página.
const marcaEntrada = () => { try { sessionStorage.setItem('pdm_sessaoAtiva', '1'); } catch { /* */ } };
const ctxAna = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctxAna.addInitScript(marcaEntrada);
await ctxAna.addCookies(cAna.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE }; }));
const pa = await ctxAna.newPage();
await pa.goto(BASE);
await pa.waitForSelector('.pos-navitem', { timeout: 20000 });
const menu = await pa.locator('.pos-sidebar').innerText();
cobra('o menu do bar novo não tem "Bar ao vivo"', !/Bar ao vivo/.test(menu));
cobra('nem pelo endereço direto', (await api('/api/aovivo', cAna)).status === 403);
await pa.evaluate(() => localStorage.setItem('picoos-tab', 'acessos'));
await pa.goto(BASE);
await pa.waitForSelector('[data-logins-equipe]', { timeout: 20000 });
cobra('Acessos mostra "Logins da equipe (0 de 5)"', /Logins da equipe \(0 de 5\)/.test(await pa.locator('[data-logins-equipe]').innerText()));
await pa.click('text=+ Criar login');
await pa.fill('[data-login-nome]', 'Bia');
await pa.selectOption('[data-login-tipo]', 'garcom');
await pa.fill('[data-login-senha]', 'bia123');
await pa.click('[data-form-login] button:has-text("Criar login")');
await pa.waitForSelector('[data-login="Bia"]');
cobra('criou a Bia pela tela, com "Atendimento" embaixo do nome', /Atendimento/.test(await pa.locator('[data-login="Bia"]').innerText()));
for (const [nome, tipo, senha] of [['Zé', 'cozinha', 'ze1234'], ['Carla', 'gerente', 'carla1'], ['Duda', 'garcom', 'duda12'], ['Lu', 'garcom', 'lulu12']]) {
  const r = await api('/api/acessos', cAna, { acao: 'criarLogin', nome, tipo, senha });
  cobra(`criou ${nome}`, r.j.ok, JSON.stringify(r.j));
}
const sexto = await api('/api/acessos', cAna, { acao: 'criarLogin', nome: 'Pedro', tipo: 'garcom', senha: 'pedro1' });
cobra('o 6º login é recusado: "O limite é de 5"', !sexto.j.ok && /limite é de 5/.test(sexto.j.erro || ''), sexto.j.erro);
await api('/api/acessos', cAna, { acao: 'apagarLogin', id: (await api('/api/acessos', cAna)).j.logins.find((l) => l.nome === 'Lu').id });
const repetido = await api('/api/acessos', cAna, { acao: 'criarLogin', nome: 'bia', tipo: 'garcom', senha: 'outra1' });
cobra('nome repetido ("bia" = "Bia") é recusado', !repetido.j.ok && /Já existe/.test(repetido.j.erro || ''));
cobra('"Dona" como nome é recusado', /reservado/.test((await api('/api/acessos', cAna, { acao: 'criarLogin', nome: 'Dona', tipo: 'garcom', senha: 'abcd12' })).j.erro || ''));
cobra('senha curta é recusada', /pelo menos 4/.test((await api('/api/acessos', cAna, { acao: 'criarLogin', nome: 'Rafa', tipo: 'garcom', senha: '12' })).j.erro || ''));
const lista = await api('/api/acessos', cAna);
cobra('a tela nunca recebe a senha nem o embaralhado', !JSON.stringify(lista.j).includes('bia123') && !JSON.stringify(lista.j).includes('hash'));
cobra('no banco, a senha está só embaralhada', !JSON.stringify(await linhaCrua('n:boteco-da-ana:loginsEquipe')).includes('bia123'));

console.log('\n— cada um entra com o nome e vê a sua tela —');
await tela.goto(BASE);
await tela.waitForSelector('select[data-quem]');
await tela.fill('input[placeholder="ex: boteco-da-ana"]', 'boteco-da-ana');
await tela.waitForTimeout(900);
await tela.selectOption('select[data-quem]', 'equipe');
await tela.fill('[data-nome-equipe]', 'bia');
await tela.fill('input[type=password]', 'bia123');
await tela.click('button[type=submit]');
await tela.waitForTimeout(3000);
const telaBia = await tela.locator('body').innerText();
cobra('a Bia entra (escrevendo "bia" minúsculo) e cai no Atendimento', /Comandas|Mesas|Mesa/.test(telaBia) && !/Quem está entrando/.test(telaBia), telaBia.slice(0, 80));
const bia = await entrar('boteco-da-ana', 'equipe', 'bia123', 'Bia');
const ze = await entrar('boteco-da-ana', 'equipe', 'ze1234', 'Zé');
const carla = await entrar('boteco-da-ana', 'equipe', 'carla1', 'carla');
cobra('cada tipo abre o seu acesso (Atendimento, Cozinha, Gerência)', bia.j.papel === 'garcom' && ze.j.papel === 'cozinha' && carla.j.papel === 'gerente', [bia.j.papel, ze.j.papel, carla.j.papel].join(','));
cobra('senha errada não entra', !(await entrar('boteco-da-ana', 'equipe', 'errada', 'Bia')).ok);
cobra('nome que não existe não entra', !(await entrar('boteco-da-ana', 'equipe', 'bia123', 'Fulano')).ok);
cobra('a Bia não vê o dinheiro do bar', (await api('/api/data', bia.cookie)).status === 401);
cobra('a Bia abre as comandas', (await api('/api/comandas', bia.cookie)).status === 200);
cobra('a Gerência não mexe nos logins', (await api('/api/acessos', carla.cookie, { acao: 'criarLogin', nome: 'X', tipo: 'garcom', senha: 'xxxx' })).status === 403);
const ctxC = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctxC.addInitScript(marcaEntrada);
await ctxC.addCookies(carla.cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE }; }));
const pc = await ctxC.newPage();
await pc.goto(BASE);
await pc.waitForSelector('[data-gerente]', { timeout: 20000 });
await pc.waitForTimeout(1500);
cobra('a tela da Gerência não tem "Acesso do Extra"', !/Acesso do Extra/.test(await pc.locator('.pos-sidebar').innerText()));

console.log('\n— editar e apagar —');
const idBia = (await api('/api/acessos', cAna)).j.logins.find((l) => l.nome === 'Bia').id;
await api('/api/acessos', cAna, { acao: 'editarLogin', id: idBia, nome: 'Bia Souza' });
cobra('renomear não derruba a Bia', (await api('/api/comandas', bia.cookie)).status === 200);
cobra('e ela entra com o nome novo', (await entrar('boteco-da-ana', 'equipe', 'bia123', 'Bia Souza')).ok);
await api('/api/acessos', cAna, { acao: 'editarLogin', id: idBia, senha: 'nova99' });
// O porteiro guarda a geração de cada acesso meio minuto (pra não consultar o
// banco a cada clique) — o crachá velho cai em até 30 segundos.
await new Promise((ok) => setTimeout(ok, 32000));
cobra('trocar a senha derruba quem estava dentro (em até 30 s)', (await api('/api/comandas', bia.cookie)).status === 401);
cobra('a senha velha não entra mais; a nova entra', !(await entrar('boteco-da-ana', 'equipe', 'bia123', 'Bia Souza')).ok && (await entrar('boteco-da-ana', 'equipe', 'nova99', 'Bia Souza')).ok);
const duda = await entrar('boteco-da-ana', 'equipe', 'duda12', 'Duda');
cobra('a Duda está dentro', (await api('/api/comandas', duda.cookie)).status === 200);
const idDuda = (await api('/api/acessos', cAna)).j.logins.find((l) => l.nome === 'Duda').id;
await api('/api/acessos', cAna, { acao: 'apagarLogin', id: idDuda });
cobra('apagado: a Duda não entra mais', !(await entrar('boteco-da-ana', 'equipe', 'duda12', 'Duda')).ok);
await new Promise((ok) => setTimeout(ok, 32000));
cobra('e o aparelho dela cai (em até 30 s)', (await api('/api/comandas', duda.cookie)).status === 401);
cobra('sobram os outros 3 logins, intactos', (await api('/api/acessos', cAna)).j.logins.length === 3);

await browser.close();
console.log(ruim ? `\n${ruim} RUIM` : '\nTUDO OK');
process.exit(ruim ? 1 : 0);
