import webpush from 'web-push';
import { num, brl, todayISO, addDays, limparNome, fiadoDaVenda, abertoDaVenda, diaOperacional } from './util';
import { listarEventos } from './google';

// Push (avisos no celular) do PicoOS. Estratégia pensada pra dona não precisar
// mexer em configuração nenhuma (nem variável de ambiente na Vercel):
//   - As chaves VAPID (assinatura do push) são geradas UMA vez e guardadas na
//     nuvem, na linha 'pushConfig'. Depois é só ler de lá.
//   - Cada aparelho que ativa as notificações vira uma linha 'push:<id>'. Mandar
//     push é ler todas essas linhas e disparar. Se um aparelho expira (a pessoa
//     desinstalou / limpou), a linha é apagada sozinha (erro 404/410).
// Tudo fica no mesmo banco dos outros dados — mesmo nível de confiança.

const CHAVE_CONFIG = 'pushConfig';
const PREFIXO_SUB = 'push:';
export const SUBJECT = 'mailto:borgeskaren88@gmail.com';

// Lê (ou cria na primeira vez) as chaves VAPID guardadas na nuvem.
export async function obterConfigPush(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE_CONFIG).maybeSingle();
  const cfg = data?.valor;
  if (cfg && cfg.publicKey && cfg.privateKey) return cfg;
  // Primeira vez: gera o par de chaves e guarda.
  const chaves = webpush.generateVAPIDKeys();
  const novo = { publicKey: chaves.publicKey, privateKey: chaves.privateKey, subject: SUBJECT, criadoEm: new Date().toISOString() };
  await sb.from('pdm_dados').upsert({ chave: CHAVE_CONFIG, valor: novo, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  return novo;
}

// Id estável por aparelho, derivado do endereço da inscrição (não guarda dado sensível em claro).
function idDaSub(sub) {
  const ep = (sub && sub.endpoint) || '';
  let h = 0;
  for (let i = 0; i < ep.length; i++) { h = (h * 31 + ep.charCodeAt(i)) | 0; }
  return PREFIXO_SUB + (h >>> 0).toString(36) + '-' + ep.length.toString(36);
}

export async function salvarInscricao(sb, sub, apelido, papel) {
  if (!sub || !sub.endpoint) throw new Error('Inscrição inválida.');
  const chave = idDaSub(sub);
  const valor = { sub, apelido: apelido || '', papel: papel || 'dona', criadoEm: new Date().toISOString() };
  await sb.from('pdm_dados').upsert({ chave, valor, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
  return chave;
}

export async function removerInscricao(sb, sub) {
  if (!sub || !sub.endpoint) return;
  await sb.from('pdm_dados').delete().eq('chave', idDaSub(sub));
}

async function lerInscricoes(sb) {
  const { data } = await sb.from('pdm_dados').select('chave, valor').like('chave', PREFIXO_SUB + '%');
  return (data || []).map((r) => ({ chave: r.chave, sub: r.valor?.sub, papel: r.valor?.papel || 'dona' })).filter((x) => x.sub && x.sub.endpoint);
}

// Decide se uma inscrição entra na audiência. 'todos' = qualquer papel; um papel
// específico casa com ele (inscrições antigas sem papel contam como 'dona').
function naAudiencia(papel, audiencia) {
  if (!audiencia || audiencia === 'todos') return true;
  return (papel || 'dona') === audiencia;
}

// Manda um push pros aparelhos inscritos (filtrando por audiência, se informada).
// Best-effort: nunca lança — devolve um resumo. Aparelho morto (404/410) é apagado.
export async function enviarPush(sb, { titulo, corpo, url = '/', tag, dados, audiencia } = {}) {
  let cfg;
  try { cfg = await obterConfigPush(sb); } catch { return { ok: false, enviados: 0, erro: 'sem config' }; }
  webpush.setVapidDetails(cfg.subject || SUBJECT, cfg.publicKey, cfg.privateKey);
  const inscricoes = (await lerInscricoes(sb)).filter((x) => naAudiencia(x.papel, audiencia));
  if (!inscricoes.length) return { ok: true, enviados: 0, total: 0 };
  const payload = JSON.stringify({ title: titulo || 'PicoOS', body: corpo || '', url, tag, dados: dados || {} });
  let enviados = 0;
  const mortas = [];
  await Promise.all(inscricoes.map(async ({ chave, sub }) => {
    try { await webpush.sendNotification(sub, payload); enviados += 1; }
    catch (e) { const s = e?.statusCode; if (s === 404 || s === 410) mortas.push(chave); }
  }));
  if (mortas.length) { try { await sb.from('pdm_dados').delete().in('chave', mortas); } catch { /* ignora */ } }
  return { ok: true, enviados, total: inscricoes.length, removidas: mortas.length };
}

const arr = (v) => (Array.isArray(v) ? v : []);
const norm = (s) => limparNome(s).toLowerCase();

// Avisa a COZINHA quando a dona cria tarefa(s) nova(s). Compara a lista nova com
// a anterior (por id) e manda push só das que apareceram e ainda não estão feitas.
// Best-effort — nunca lança.
export async function notificarNovasTarefasCozinha(sb, tarefasNovas, tarefasAntigas) {
  try {
    const antigos = new Set(arr(tarefasAntigas).map((t) => t && t.id).filter(Boolean));
    const novas = arr(tarefasNovas).filter((t) => t && t.id && t.texto && !t.feito && !antigos.has(t.id));
    if (!novas.length) return { enviados: 0 };
    const corpo = novas.length === 1 ? novas[0].texto : novas.slice(0, 4).map((t) => '• ' + t.texto).join('\n');
    const titulo = novas.length === 1 ? '👩‍🍳 Nova tarefa da cozinha' : `👩‍🍳 ${novas.length} novas tarefas`;
    return await enviarPush(sb, { titulo, corpo, url: '/', tag: 'tarefa-cozinha', audiencia: 'cozinha' });
  } catch { return { enviados: 0 }; }
}

// Avisa NA HORA quando um item do estoque "cruza" pra zero (acabou) ou pro
// mínimo, comparando o saldo antes x depois de uma baixa (venda, perda, saída).
// Só dispara na transição — não fica repetindo a cada venda enquanto está baixo.
// Best-effort — nunca lança.
export async function notificarEstoqueCritico(sb, estoqueAntes, estoqueDepois) {
  try {
    const antes = new Map(arr(estoqueAntes).map((it) => [it.id, num(it.saldo)]));
    const avisos = [];
    for (const it of arr(estoqueDepois)) {
      const sAntes = antes.get(it.id);
      if (sAntes == null) continue;
      const sDepois = num(it.saldo);
      const min = num(it.minimo);
      const limite = min > 0 ? min : 0; // sem mínimo definido, avisa quando zera
      if (sAntes > limite && sDepois <= limite) {
        avisos.push({ nome: limparNome(it.nome), un: it.unidade || 'un', saldo: sDepois, acabou: sDepois <= 0.0001 });
      }
    }
    if (!avisos.length) return { enviados: 0 };
    const desc = (a) => (a.acabou ? `${a.nome} (acabou)` : `${a.nome} (${a.saldo} ${a.un})`);
    let titulo, corpo;
    if (avisos.length === 1) {
      titulo = avisos[0].acabou ? `Acabou: ${avisos[0].nome}` : `Estoque baixo: ${avisos[0].nome}`;
      corpo = avisos[0].acabou ? 'Chegou a zero no estoque. Repor.' : `Está no mínimo (${avisos[0].saldo} ${avisos[0].un}).`;
    } else {
      const zerados = avisos.filter((a) => a.acabou).length;
      titulo = zerados ? `${zerados} item(ns) acabaram no estoque` : `${avisos.length} itens no mínimo`;
      corpo = avisos.slice(0, 6).map(desc).join(', ');
    }
    return await enviarPush(sb, { titulo, corpo, url: '/', tag: 'estoque-critico-' + Date.now(), audiencia: 'dona' });
  } catch { return { enviados: 0 }; }
}

// Monta o resumo diário: estoque no mínimo, fiado no limite, conta vencendo hoje
// e quanto vendeu ontem. Devolve { titulo, corpo, url } ou null se não há nada
// que valha um aviso. Só leitura.
export async function montarResumoDiario(sb) {
  const { data: painelRow } = await sb.from('pdm_dados').select('valor').eq('chave', 'painel').maybeSingle();
  const painel = painelRow?.valor || {};
  const hoje = todayISO(); // calendário (pra contas vencendo e agenda de hoje)
  // "Ontem" no dia operacional do bar: a madrugada conta como o dia anterior.
  const ontem = addDays(diaOperacional(new Date()), -1);

  // Estoque no mínimo (saldo <= mínimo, com mínimo definido).
  const baixos = arr(painel.estoque).filter((it) => { const min = num(it.minimo); return min > 0 && num(it.saldo) <= min; });

  // Contas a pagar vencendo hoje (ainda não pagas).
  const totalCompra = (c) => num(c.quantidade) * num(c.valorUnit);
  const vencemHoje = arr(painel.compras).filter((c) => c && c.pago !== 'Sim' && c.vencimento === hoje);
  const totalVence = vencemHoje.reduce((s, c) => s + totalCompra(c), 0);

  // Fiados no limite: soma por cliente vs. limite cadastrado.
  const { data: vrows } = await sb.from('pdm_dados').select('valor').like('chave', 'venda:%');
  const vendas = (vrows || []).map((r) => r.valor).filter(Boolean);
  const abertos = vendas.filter((v) => !v.pago && abertoDaVenda(v) > 0.005);
  const porCliente = new Map();
  for (const v of abertos) { const k = norm(v.nome); if (!k) continue; porCliente.set(k, { nome: limparNome(v.nome), total: (porCliente.get(k)?.total || 0) + abertoDaVenda(v) }); }
  const limitePorNome = new Map(arr(painel.clientes).map((c) => [norm(c.nome), num(c.limite)]));
  const noLimite = [...porCliente.values()].filter((g) => { const lim = limitePorNome.get(norm(g.nome)) || 0; return lim > 0 && g.total >= lim - 0.005; });

  // Caixa de ontem: soma o "recebido" dos caixas fechados ontem (mesmo número do
  // widget). Se não fechou caixa ontem, cai nas comandas de ontem como aproximação.
  const { data: cxrows } = await sb.from('pdm_dados').select('valor').like('chave', 'caixa:%');
  const caixasOntem = (cxrows || []).map((r) => r.valor).filter((c) => c && !c.aberto && c.fechadoEm && diaOperacional(c.fechadoEm) === ontem);
  const caixaRecebidoOntem = Math.round(caixasOntem.reduce((s, c) => s + num(c.recebido), 0) * 100) / 100;

  // Quanto vendeu ontem (vendas fechadas de ontem).
  const vendasOntem = vendas.filter((v) => (v.data || '') === ontem);
  const totalOntem = vendasOntem.reduce((s, v) => s + num(v.total), 0);

  // Agenda de hoje (Google Agenda), se conectado.
  let agendaHoje = [];
  try {
    const eventos = await listarEventos();
    if (Array.isArray(eventos)) {
      agendaHoje = eventos
        .filter((e) => (e.inicio || '').slice(0, 10) === hoje && !e.concluida)
        .map((e) => {
          const hora = !e.diaTodo && (e.inicio || '').length >= 16 ? e.inicio.slice(11, 16) + ' ' : '';
          return `${hora}${e.titulo}`;
        });
    }
  } catch { /* agenda é opcional */ }

  const fiadoOntem = vendasOntem.reduce((s, v) => s + fiadoDaVenda(v), 0);
  const recebidoOntem = Math.round((totalOntem - fiadoOntem) * 100) / 100;

  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const linhas = [];
  // Caixa de ontem PELO QUE A DONA LANÇA NA FINANÇAS (soma das receitas do dia,
  // sem "Recebimento Atrasado"), pra bater com Finanças/Log. Só se não lançou é
  // que cai no caixa fechado / comandas como aproximação.
  const receitaOntem = Math.round(arr(painel.receitas).filter((r) => r && (r.data || '') === ontem && (r.categoria || '') !== 'Recebimento Atrasado').reduce((s, r) => s + num(r.valor), 0) * 100) / 100;
  const temCaixa = caixasOntem.length > 0;
  let dinheiroOntem = temCaixa ? caixaRecebidoOntem : recebidoOntem;
  if (receitaOntem > 0) dinheiroOntem = receitaOntem;
  if (dinheiroOntem > 0 || fiadoOntem > 0.005) {
    linhas.push(`Caixa de ontem: ${brl(dinheiroOntem)}`);
    if (fiadoOntem > 0.005) {
      linhas.push(`Fiado de ontem: ${brl(fiadoOntem)}`);
      const totalDia = Math.round((dinheiroOntem + fiadoOntem) * 100) / 100;
      linhas.push(`Total do dia: ${brl(totalDia)} (caixa + fiado)`);
    }
  }
  if (agendaHoje.length) linhas.push(`Agenda de hoje: ${agendaHoje.slice(0, 6).join(' · ')}${agendaHoje.length > 6 ? '…' : ''}`);
  if (vencemHoje.length) linhas.push(`Contas vencendo hoje: ${plural(vencemHoje.length, 'conta', 'contas')} (${brl(totalVence)})`);
  if (baixos.length) linhas.push(`Estoque no mínimo: ${baixos.slice(0, 4).map((it) => it.nome).join(', ')}${baixos.length > 4 ? `, +${baixos.length - 4}` : ''}`);
  if (noLimite.length) linhas.push(`Fiados no limite: ${noLimite.slice(0, 4).map((g) => g.nome).join(', ')}${noLimite.length > 4 ? `, +${noLimite.length - 4}` : ''}`);

  if (!linhas.length) return null;
  return { titulo: 'Resumo do dia — Pico do Mané', corpo: linhas.join('\n'), url: '/' };
}

// Throttle: garante no máximo um envio do resumo por dia (mesmo que o cron bata
// mais de uma vez). Guarda a data do último envio na config.
export async function jaMandouResumoHoje(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', 'pushConfig').maybeSingle();
  return (data?.valor?.ultimoResumo || '') === todayISO();
}
export async function marcarResumoEnviado(sb) {
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', 'pushConfig').maybeSingle();
  const cfg = data?.valor || {};
  await sb.from('pdm_dados').upsert({ chave: 'pushConfig', valor: { ...cfg, ultimoResumo: todayISO() }, atualizado_em: new Date().toISOString() }, { onConflict: 'chave' });
}
