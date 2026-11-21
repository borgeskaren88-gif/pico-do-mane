// "CONTRATEI UMA MENINA PRA TRABALHAR, ELA SE CHAMA SARAH E VAI ENTRAR COMO
// GERENTE DO BAR. ELA VAI APRENDER TODAS AS ÁREAS, PRA QUANDO PRECISAR SALVAR."
//
// O que a dona decidiu: Atendimento e Cozinha inteiros; notificação de
// reserva; a meta SÓ em porcentagem; o ponto dela com o saldo; controle de
// doses, cortesia e perda; ver a equipe no ponto; ver e cobrar o fiado; abrir
// e fechar o acesso do Extra. E uma tela inicial bonita, com um calendário em
// que a dona põe tarefas e elas aparecem pra ela.
//
// O QUE ESTE TESTE GUARDA:
//
//   - A PORTA NASCE FECHADA. Sem a dona criar a senha, nada entra.
//   - ELA FAZ O QUE A EQUIPE FAZ: comandas, caixa, estoque da cozinha, fichas.
//   - E NÃO VÊ O DINHEIRO DO BAR: nem vendas, nem o painel, nem o Darci.
//   - A META SAI EM PORCENTAGEM. O valor da meta e o faturamento NÃO saem do
//     servidor — nem escondidos na resposta.
//   - O PONTO DELA É DELA. O salário da equipe não chega no aparelho dela.
//   - O FIADO: vê e cobra, mas não cria cliente novo.
//   - AS GARRAFAS: ela conta e o resultado volta em doses, sem reais.
//   - O EXTRA: ela abre e fecha; nenhum outro acesso.
//   - AS TAREFAS: a dona põe no calendário do Brain; aparece na tela inicial
//     dela; ela marca feita; e uma cópia velha da dona não desmarca.
//   - FECHAR A GERENTE DERRUBA QUEM ESTAVA DENTRO.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const BANCO = 'http://127.0.0.1:54321/rest/v1/pdm_dados';
const MARCA = process.env.LAB_MARCA || '';
let ruim = 0;
const cobra = (r, ok, e = '') => { if (!ok) ruim++; console.log(`  ${ok ? 'ok  ' : 'RUIM'}  ${r}${e ? `  [${e}]` : ''}`); };
const linha = async (chave) => (await (await fetch(`${BANCO}?select=valor&chave=eq.${MARCA}${chave}`)).json())[0]?.valor;
const painel = async () => (await linha('painel')) || {};
const gravarLinha = (chave, v) => fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ chave: `${MARCA}${chave}`, valor: v }]) });
const gravar = (v) => gravarLinha('painel', v);
const limpa = (s) => String(s || '').replace(/ /g, ' ');
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const MES = HOJE.slice(0, 7);
const SENHA = 'Sarah@2026';
const META = 50000;
const FATURADO = 12345.67;

const p0 = await painel();
await gravar({ ...p0,
  negocio: { nome: 'Pico do Mané', cidade: 'Florianópolis', dona: 'Karen', papeis: { dona: 'Karen', garcom: 'Atendimento' } },
  mesasQtd: 6,
  metas: { [MES]: String(META) },
  receitas: [{ id: 'r1', data: `${MES}-01`, categoria: 'Caixa', descricao: 'Caixa', valor: String(FATURADO) }],
  cardapio: [{ id: 'hk', nome: 'Heineken', categoria: 'Bebidas', preco: '14', ativo: true }],
  estoque: [{ id: 'hei', nome: 'Heineken long neck', custo: '7,50', unidade: 'un', saldo: '20', categoria: 'Bebidas' }],
  fichas: [{ cardapioId: 'hk', itens: [{ estoqueId: 'hei', qtd: '1', unidade: 'un' }] }],
  clientes: [{ id: 'c1', nome: 'Tamara Silva', telefone: '48999990000', limite: '300', bloquear: true }],
  tarefasGerente: [], despesas: [], compras: [], diario: [],
});
await gravarLinha('jornadas', {
  gerente: { nome: 'Sarah Lima', dias: [3, 4, 5, 6], entrada: '16:00', saida: '00:00', salarioMes: 3200 },
  garcom: { nome: 'João', dias: [5, 6], entrada: '18:00', saida: '02:00', salarioMes: 1850 },
});
for (const k of ['f1', 'pg1', 'pg2']) await fetch(`${BANCO}?chave=like.${MARCA}*${k}`, { method: 'DELETE' });
await fetch(BANCO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([
  { chave: `${MARCA}venda:f1`, valor: { id: 'f1', data: HOJE, mesa: '2', nome: 'Tamara Silva', total: 90, fiado: 90, pagamento: 'Fiado', fechadaEm: `${HOJE}T20:00:00`, itens: [] } },
  // O João do atendimento está no turno agora.
  { chave: `${MARCA}ponto:pg1`, valor: { id: 'pg1', nome: 'João', entrada: new Date(Date.now() - 2 * 3600e3).toISOString(), saida: null, data: HOJE, papel: 'garcom' } },
]) });

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const novo = async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 160)); ruim++; });
  pg.on('dialog', (d) => d.accept());
  await pg.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  return pg;
};
const entrar = async (pg, botao, senha) => {
  await pg.locator('select[data-quem]').selectOption({ label: `${botao}` });
  await pg.locator('input[type="password"]').first().fill(senha);
  await pg.locator('button:has-text("Entrar")').first().click();
  await pg.waitForTimeout(4000);
};
const tentar = (pg, papel, senha) => pg.evaluate(async (x) => (await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ papel: x.papel, senha: x.senha, lembrar: true }) })).status, { papel, senha });
const pedir = (pg, url, corpo) => pg.evaluate(async (x) => {
  const r = await fetch(x.url, x.corpo ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(x.corpo) } : { cache: 'no-store' });
  let j = null; let t = '';
  try { t = await r.text(); j = JSON.parse(t); } catch { /* sem json */ }
  return { status: r.status, j, t };
}, { url, corpo });
const tocar = (pg, rot) => pg.evaluate((r) => {
  const lim = (t) => String(t || '').replace(/ /g, ' ').trim().toLowerCase();
  const x = [...document.querySelectorAll('button')].find((e) => lim(e.innerText) === r.toLowerCase());
  if (x) { x.click(); return true; }
  return false;
}, rot);
const texto = async (pg) => limpa(await pg.locator('body').innerText());

// ---------------------------------------------------------------------------
console.log('\n### A PORTA NASCE FECHADA');
const rua = await novo();
let papeis = (await pedir(rua, '/api/negocio')).j.papeis.map((x) => x[0]);
cobra('a tela de entrada não tem "Gerente"', !papeis.includes('gerente'), papeis.join(','));
cobra('"1234" não abre', (await tentar(rua, 'gerente', '1234')) === 401);
cobra('a senha da dona não abre', (await tentar(rua, 'gerente', 'Teste@123')) === 401);

console.log('\n### A DONA ABRE, EM ACESSOS');
const dona = await novo();
await entrar(dona, 'Karen', 'Teste@123');
const ac = (await pedir(dona, '/api/acessos')).j.acessos.find((a) => a.papel === 'gerente');
cobra('Acessos tem o cartão da Gerente, fechado', !!ac && ac.fechado === true && ac.podeFechar === true, JSON.stringify(ac));
const abriu = await pedir(dona, '/api/acessos', { acao: 'senha', papel: 'gerente', nova: SENHA });
cobra('a dona criou a senha da Sarah', abriu.status === 200, JSON.stringify(abriu.j));
papeis = (await pedir(rua, '/api/negocio')).j.papeis.map((x) => x[0]);
cobra('agora a tela de entrada tem "Gerente"', papeis.includes('gerente'), papeis.join(','));
cobra('e a senha da Sarah não abre o atendimento', (await tentar(rua, 'garcom', SENHA)) === 401);

// ---------------------------------------------------------------------------
console.log('\n### A DONA PÕE UMA TAREFA NO CALENDÁRIO DO BRAIN');
cobra('abriu o Brain', await tocar(dona, 'Brain'));
await dona.waitForTimeout(1800);
cobra('o calendário "Tarefas da gerente" está lá', (await dona.locator('[data-calendario="dona"]').count()) === 1);
await dona.locator(`[data-calendario="dona"] button[data-dia="${HOJE}"]`).click();
await dona.locator('[data-calendario="dona"] input').fill('Conferir o estoque de gelo');
await dona.locator('[data-calendario="dona"] button:has-text("Adicionar")').click();
await dona.waitForTimeout(2800);
let tg = (await painel()).tarefasGerente || [];
cobra('a tarefa foi salva pra hoje', tg.length === 1 && tg[0].texto === 'Conferir o estoque de gelo' && tg[0].data === HOJE, JSON.stringify(tg));

// ---------------------------------------------------------------------------
console.log('\n### A SARAH ENTRA E CAI NA TELA INICIAL DELA');
const sarah = await novo();
// "Tá ficando muito login, aí fica poluído": uma caixa com setinha, não um
// botão por login.
const opcoes = await sarah.locator('select[data-quem] option').allInnerTexts();
cobra('a tela de entrada tem UMA caixa com setinha, e o Gerente está na lista', opcoes.includes('Gerente') && (await sarah.locator('select[data-quem]').count()) === 1, opcoes.join(','));
cobra('e nenhum botão por login', (await sarah.locator('button:text-is("Gerente"), button:text-is("Atendimento"), button:text-is("Cozinha")').count()) === 0);
await entrar(sarah, 'Gerente', SENHA);
await sarah.waitForTimeout(1500);
cobra('o aparelho dela lembra que quem entrou foi a Gerente', (await sarah.evaluate(() => localStorage.getItem('picoos-ultimo-papel'))) === 'gerente');
let tela = await texto(sarah);
cobra('a tela inicial cumprimenta pelo nome', /(Bom dia|Boa tarde|Boa noite), Sarah!/.test(tela), (tela.match(/[^\n]*(Bom dia|Boa tarde|Boa noite)[^\n]*/) || ['(sem cumprimento)'])[0]);
cobra('e avisa da tarefa de hoje', /Tu tens 1 tarefa pra hoje/.test(tela), (tela.match(/[^\n]*tarefa[^\n]*/) || [''])[0]);
// O MENU IGUAL AO DA DONA: os mesmos grupos, um assunto por tela.
const grupos = await sarah.locator('.pos-group-title').allInnerTexts();
cobra('o menu do lado tem os grupos do menu da dona: Início, Operação, Cozinha, Gestão', grupos.map((x) => x.trim().toLowerCase()).join(',') === 'início,operação,cozinha,gestão', grupos.join(','));
const itens = await sarah.locator('[data-nav]').evaluateAll((els) => els.map((e) => e.getAttribute('data-nav')));
cobra('com cada tela no seu lugar', itens.join(',') === 'inicio,aovivo,salao,reservas,controle,ponto,compras,porcoes,estoque,fichas,equipe,extra,avisos', itens.join(','));
const badge = limpa(await sarah.locator('[data-nav="inicio"] .pos-badge').innerText().catch(() => ''));
cobra('e o Início mostra no menu que tem 1 tarefa esperando', badge === '1', badge || '(sem número)');
// 12.345,67 de 50.000 = 24,69% -> 25%.
const meta = limpa(await sarah.locator('[data-gerencia="meta"]').innerText()).replace(/\s+/g, ' ');
cobra('a meta aparece em porcentagem: 25%', /25%/.test(meta), meta);
cobra('e sem nenhum valor em reais', !/R\$/.test(meta), meta);
cobra('a tarefa da dona está no calendário dela', /Conferir o estoque de gelo/.test(limpa(await sarah.locator('[data-calendario="gerente"]').innerText())));
const eq = limpa(await sarah.locator('[data-gerencia="equipe"]').innerText()).replace(/\s+/g, ' ');
cobra('a equipe no turno: o João, no Atendimento', /João · Atendimento/.test(eq), eq);

console.log('\n### ELA MARCA A TAREFA COMO FEITA');
const idT = tg[0].id;
await sarah.locator(`[data-calendario="gerente"] button[data-marcar="${idT}"]`).click();
await sarah.waitForTimeout(2200);
cobra('ficou feita no banco', ((await painel()).tarefasGerente || [])[0]?.feito === true);
// A dona estava com a tela aberta e adiciona outra: a cópia dela diz que a
// primeira NÃO está feita. Isso não pode desmarcar o que a Sarah fez.
await dona.locator('[data-calendario="dona"] input').fill('Ligar pro fornecedor de gelo');
await dona.locator('[data-calendario="dona"] button:has-text("Adicionar")').click();
await dona.waitForTimeout(2800);
tg = (await painel()).tarefasGerente || [];
cobra('a dona adicionou a segunda', tg.length === 2, JSON.stringify(tg.map((t) => t.texto)));
cobra('e a primeira continua feita', tg.find((t) => t.id === idT)?.feito === true, JSON.stringify(tg.map((t) => [t.texto, t.feito])));
const ger = (await pedir(sarah, '/api/gerencia', { acao: 'tarefa', id: idT, feito: true }));
cobra('ela não cria tarefa (só marca a que existe)', (await pedir(sarah, '/api/gerencia', { acao: 'tarefa', id: 'inventada', feito: true })).status === 404 && ger.status === 200);

// ---------------------------------------------------------------------------
console.log('\n### ELA FAZ O QUE A EQUIPE FAZ');
cobra('comandas', (await pedir(sarah, '/api/comandas')).status === 200);
cobra('caixa', (await pedir(sarah, '/api/caixa')).status === 200);
cobra('estoque da cozinha', (await pedir(sarah, '/api/estoque')).status === 200);
cobra('fichas em PDF', (await pedir(sarah, '/api/fichas-arquivo')).status === 200);
cobra('pedido pronto', (await pedir(sarah, '/api/pronto')).status === 200);
cobra('reservas', (await pedir(sarah, '/api/reservas')).status === 200);
cobra('notificações no celular', (await pedir(sarah, '/api/push')).status === 200);
const ab = await pedir(sarah, '/api/comandas', { acao: 'abrir', mesa: '3', pessoas: 2 });
cobra('abre mesa', ab.status === 200 && !!ab.j?.comanda?.id, JSON.stringify(ab.j).slice(0, 100));

console.log('\n### E NÃO VÊ O DINHEIRO DO BAR');
cobra('não vê as vendas', (await pedir(sarah, '/api/vendas')).status === 401);
cobra('não lê o painel da dona', (await pedir(sarah, '/api/data')).status === 401);
cobra('não fala com o Darci', (await pedir(sarah, '/api/darci/perguntar', { pergunta: 'quanto faturamos?' })).status === 401);
cobra('não faz backup', (await pedir(sarah, '/api/backup')).status === 401);
const g = await pedir(sarah, '/api/gerencia');
// O valor da meta e o faturamento não podem viajar, nem escondidos.
cobra('a resposta dela não traz o valor da meta', !g.t.includes('50000') && !g.t.includes('50.000'), (g.t.match(/50\.?000/) || ['(não traz, certo)'])[0]);
cobra('nem o faturamento', !g.t.includes('12345') && !g.t.includes('12.345'), (g.t.match(/12\.?345/) || ['(não traz, certo)'])[0]);
cobra('nem o custo da Heineken', !/7[.,]5/.test(JSON.stringify(g.j.doses)), JSON.stringify(g.j.doses).slice(0, 160));

// ---------------------------------------------------------------------------
console.log('\n### O PONTO DELA É DELA');
const pe = await pedir(sarah, '/api/ponto', { acao: 'entrada', nome: 'Sarah Lima' });
cobra('ela bateu o ponto como Gerente', pe.status === 200 && pe.j?.registro?.papel === 'gerente', JSON.stringify(pe.j?.registro || pe.j).slice(0, 120));
const pp = await pedir(sarah, '/api/ponto');
cobra('recebe a jornada dela (pra ver o saldo)', !!pp.j.jornadas?.gerente, JSON.stringify(Object.keys(pp.j.jornadas || {})));
cobra('e NÃO recebe a do atendimento, com o salário', !pp.j.jornadas?.garcom && !pp.t.includes('1850'), JSON.stringify(Object.keys(pp.j.jornadas || {})));
cobra('vê só os turnos dela', (pp.j.registros || []).every((r) => r.papel === 'gerente'), JSON.stringify((pp.j.registros || []).map((r) => r.papel)));
// O João, do atendimento, não pode receber a jornada da gerente.
const joao = await novo();
await entrar(joao, 'Atendimento', '1234');
const pj = await pedir(joao, '/api/ponto');
cobra('o atendimento não recebe a jornada nem o salário da gerente', !pj.j.jornadas?.gerente && !pj.t.includes('3200'), JSON.stringify(Object.keys(pj.j.jornadas || {})));
cobra('e o atendimento não vê a lista da equipe', pj.j.equipeHoje === undefined);
const ca = await pedir(sarah, '/api/caixa', { acao: 'abrir', saldoInicial: '50' });
cobra('com o ponto batido, ela abre o caixa', ca.status === 200 && ca.j?.ok, JSON.stringify(ca.j).slice(0, 100));

console.log('\n### O FIADO: VÊ E COBRA');
const tam = (g.j.fiados || []).find((f) => f.nome === 'Tamara Silva');
cobra('vê que a Tamara deve R$ 90,00', !!tam && tam.total === 90, JSON.stringify(tam));
cobra('com o botão do WhatsApp pronto', !!tam && /^https:\/\/wa\.me\/5548999990000\?text=/.test(tam.link), tam && tam.link.slice(0, 60));
cobra('e a mesma mensagem da cobrança da dona', !!tam && /seu débito está em R\$\s90,00/.test(limpa(tam.mensagem)), tam && limpa(tam.mensagem).slice(0, 90));
// Cliente novo de fiado é decisão da dona.
await pedir(sarah, '/api/comandas', { acao: 'add', comandaId: ab.j.comanda.id, cardapioId: 'hk' });
const nf = await pedir(sarah, '/api/comandas', { acao: 'fechar', comandaId: ab.j.comanda.id, pessoas: 2, nome: 'Fulano Novo', pagamentos: [{ forma: 'Fiado', valor: 15.4 }] });
cobra('não cria cliente novo de fiado', nf.status === 400 && /não está na lista de clientes/.test(nf.j?.erro || ''), JSON.stringify(nf.j).slice(0, 140));

console.log('\n### AS GARRAFAS: ELA CONTA, VOLTA EM DOSES');
const ds = await pedir(sarah, '/api/gerencia', { acao: 'doses', tipo: 'acabou', itens: [{ id: 'hei', cheias: 18 }] });
cobra('a contagem foi aceita', ds.status === 200 && ds.j?.ok, JSON.stringify(ds.j).slice(0, 140));
const res = (ds.j?.resultados || [])[0] || {};
cobra('volta o veredito, sem custo, venda nem saldo esperado', res.estado === 'partida' && !('custo' in res) && !('venda' in res) && !('esperado' in res), JSON.stringify(res));
const reg = (((await painel()).controleDoses || {}).registros || [])[0] || {};
cobra('e a dona recebe o registro completo, marcado como da gerência', reg.por === 'gerente' && reg.estoqueId === 'hei' && 'custo' in reg, JSON.stringify({ por: reg.por, custo: reg.custo }));
cobra('desfazer contagem é só com a dona', (await pedir(sarah, '/api/estoque', { acao: 'desfazerContagens' })).status === 403);
cobra('o estoque foi acertado pro que ela contou', Number(((await painel()).estoque || []).find((x) => x.id === 'hei')?.saldo) === 18);

console.log('\n### O EXTRA: ELA ABRE, E SÓ ELE');
const vis = (await pedir(sarah, '/api/acessos')).j.acessos.map((a) => a.papel);
cobra('em Acessos ela só vê o Extra', vis.length === 1 && vis[0] === 'extra', vis.join(','));
cobra('abre o Extra', (await pedir(sarah, '/api/acessos', { acao: 'senha', papel: 'extra', nova: 'extra123' })).status === 200);
cobra('a senha do Extra funciona', (await tentar(rua, 'extra', 'extra123')) === 200);
cobra('mas não troca a senha do atendimento', (await pedir(sarah, '/api/acessos', { acao: 'senha', papel: 'garcom', nova: 'hackeada' })).status === 403);
cobra('nem a própria', (await pedir(sarah, '/api/acessos', { acao: 'senha', papel: 'gerente', nova: 'outra123' })).status === 403);
cobra('e o atendimento continua com a senha dele', (await tentar(rua, 'garcom', '1234')) === 200);

console.log('\n### NA TELA: CADA ITEM DO MENU ABRE A SUA TELA');
await sarah.reload({ waitUntil: 'domcontentloaded' });
await sarah.waitForTimeout(3500);
// No celular o menu fica guardado: abre pelos três risquinhos, como o da dona.
const abrir = async (id) => {
  await sarah.locator('.pos-burger').click();
  await sarah.waitForTimeout(400);
  await sarah.locator(`[data-nav="${id}"]`).click();
  await sarah.waitForTimeout(1800);
  return (await texto(sarah)).replace(/\s+/g, ' ');
};
const corpo = (t) => t.slice(t.indexOf('PicoOS', t.indexOf('Sair') + 1));
const visto = [];
tela = await abrir('salao'); visto.push(tela);
cobra('Central de Operações: as abinhas Caixa, Comandas, Fiados, Perdas e consumo', (await sarah.locator('[data-sub]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sub')))).join(',') === 'caixa,comandas,fiados,perdas');
cobra('e abre nas comandas, com as mesas', /Central de Operações/.test(corpo(tela)) && /Balcão|Mesa/i.test(corpo(tela)) && !/Fiado pra cobrar/.test(tela), corpo(tela).slice(0, 160));
await sarah.locator('[data-sub="fiados"]').click(); await sarah.waitForTimeout(1500);
tela = (await texto(sarah)).replace(/\s+/g, ' '); visto.push(tela);
cobra('a abinha Fiados mostra quem cobrar', /Fiado pra cobrar/.test(tela) && /Tamara Silva/.test(tela));
await sarah.locator('[data-sub="perdas"]').click(); await sarah.waitForTimeout(1500);
tela = (await texto(sarah)).replace(/\s+/g, ' '); visto.push(tela);
cobra('e Perdas e consumo é a tela do atendimento', /cortesia|perda|consumo/i.test(corpo(tela)), corpo(tela).slice(0, 140));
tela = await abrir('ponto'); visto.push(tela);
cobra('no Ponto, o nome dela já vem pronto e o saldo de horas aparece', /Sarah Lima/.test(tela) && /(em dia|em haver|devendo)/.test(tela) && !/aparece quando a dona configurar/.test(tela), (tela.match(/Sarah Lima.{0,80}/) || [tela.slice(0, 160)])[0]);
cobra('sem reais no ponto dela', !/R\$/.test(tela));
tela = await abrir('controle'); visto.push(tela);
cobra('Controle: as garrafas pra contar', /Acabou a garrafa/.test(tela) && /Heineken long neck/.test(tela));
tela = await abrir('compras'); visto.push(tela);
cobra('Lista de compras: a da cozinha, sem a barra de abas da cozinha por cima', /Lista de Compras/.test(tela) && !/Porções Estoque Fichas Garrafas/.test(tela), corpo(tela).slice(0, 140));
tela = await abrir('porcoes'); visto.push(tela);
cobra('Porções abre', /Porç/.test(corpo(tela)));
tela = await abrir('fichas'); visto.push(tela);
cobra('Fichas abre', /ficha/i.test(corpo(tela)));
tela = await abrir('equipe'); visto.push(tela);
cobra('Equipe: o João no turno', /João · Atendimento/.test(tela));
tela = await abrir('extra'); visto.push(tela);
cobra('Acesso do Extra: só o cartão do Extra', /Extra/.test(corpo(tela)) && !/Trocar a senha da dona|Atendimento.*1234/i.test(corpo(tela)), corpo(tela).slice(0, 160));
tela = await abrir('inicio');
cobra('e o Início volta pro cumprimento', /(Bom dia|Boa tarde|Boa noite), Sarah!/.test(tela));
cobra('em nenhuma tela fala de Finanças, lucro ou despesas', visto.every((t) => !/Finanças|Lucro operacional|Despesas do mês|Faturamento/.test(t)));
// Atualizar a página volta pra mesma tela, como no painel da dona.
await abrir('controle');
await sarah.reload({ waitUntil: 'domcontentloaded' });
await sarah.waitForTimeout(3500);
cobra('atualizar a página não joga ela de volta pro início', /Acabou a garrafa/.test(await texto(sarah)));

// ---------------------------------------------------------------------------
console.log('\n### FECHAR A GERENTE DERRUBA QUEM ESTAVA DENTRO');
const gAntes = ((await linha('acessosGeracoes')) || {}).gerente || 1;
cobra('a dona fechou', (await pedir(dona, '/api/acessos', { acao: 'fechar', papel: 'gerente' })).status === 200);
cobra('a geração da gerente subiu', (((await linha('acessosGeracoes')) || {}).gerente || 1) > gAntes);
cobra('a senha antiga não entra', (await tentar(rua, 'gerente', SENHA)) === 401);
await rua.waitForTimeout(32000);
cobra('o aparelho da Sarah caiu', (await pedir(sarah, '/api/comandas')).status === 401);
// O aparelho lembrava "Gerente", mas essa porta fechou: a caixa não pode
// ficar escolhida num login que não existe mais.
await sarah.reload({ waitUntil: 'domcontentloaded' });
await sarah.waitForTimeout(3500);
const escolhido = await sarah.locator('select[data-quem]').inputValue().catch(() => '(sem tela de entrada)');
cobra('na tela de entrada dela a caixa volta pra um login que existe', escolhido !== 'gerente' && !(await sarah.locator('select[data-quem] option').allInnerTexts()).includes('Gerente'), escolhido);
// O que conta é o que VAI pro login, não só o que aparece: a caixa mostra
// "Karen", então a senha da Karen tem que entrar sem mexer em nada.
const mostra = await sarah.locator('select[data-quem]').evaluate((el) => el.options[el.selectedIndex]?.text || '');
let mandou = '';
sarah.on('request', (r) => { if (r.url().endsWith('/api/login') && r.method() === 'POST') { try { mandou = JSON.parse(r.postData() || '{}').papel || ''; } catch { /* nada */ } } });
await sarah.locator('input[type="password"]').first().fill('Teste@123');
await sarah.locator('button:has-text("Entrar")').first().click();
await sarah.waitForTimeout(3000);
cobra('e entra como quem aparece escolhido (sem mexer na caixa)', mostra === 'Karen' && mandou === 'dona', `mostra=${mostra} mandou=${mandou}`);
cobra('e o atendimento continua dentro', (await pedir(joao, '/api/comandas')).status === 200);

await b.close();
console.log(ruim === 0 ? '\nTUDO OK' : `\n${ruim} COISA(S) RUIM(NS)`);
process.exit(ruim === 0 ? 0 : 1);
