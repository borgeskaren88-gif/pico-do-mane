'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { C, Card, Btn, inputStyle } from './ui';
import MicBtn from './MicBtn';
import OrbDarci from './OrbDarci';
import { num, brl, addDays, ymOf, limparNome, fiadoDaVenda, abertoDaVenda, diaOperacional } from '../lib/util';

// DARCI: o sócio manezinho do PicoOS. Conhece os números do bar de cabeça e
// conversa com a Karen por voz. Ele NÃO inventa nada — tudo que fala sai dos
// dados do próprio sistema (caixa, fiado, estoque, contas, vendas).
// O sotaque é leve, do jeito da ilha: trata por "tu", direto e sem enrolação —
// sem forçar gíria, que fica caricato.

const ATRASADO = 'Recebimento Atrasado';
const CHAVE_VOZ = 'picoos-voz-darci';
// Tira acento e caixa, pra casar a pergunta sem depender de como ela escreveu.
const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tem = (t, ...palavras) => palavras.some((p) => t.includes(p));
const lista = (arr, n = 3) => arr.slice(0, n).join(', ');
const plural = (n, um, muitos) => `${n} ${n === 1 ? um : muitos}`;
// Nomes comuns de vozes masculinas de pt-BR nos aparelhos (iPhone, Android, PC).
const MASC = /felipe|ricardo|daniel|jo[aã]o|eddy|reed|rocko|male|mascul/i;

export default function Darci({ receitas = [], despesas = [], compras = [], vendas = [], estoque = [], tarefas = [], clientes = [] }) {
  const [pergunta, setPergunta] = useState('');
  const [conversa, setConversa] = useState([]); // { de:'karen'|'darci', texto }
  const [falando, setFalando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [vozOk, setVozOk] = useState(false);
  const [vozes, setVozes] = useState([]);   // vozes pt-BR do aparelho
  const [vozId, setVozId] = useState('');   // voiceURI escolhido
  const fimRef = useRef(null);
  const timerRef = useRef(null);
  const vozIdRef = useRef('');
  useEffect(() => { vozIdRef.current = vozId; }, [vozId]);

  // Descobre as vozes do aparelho e escolhe uma masculina de pt-BR quando houver.
  useEffect(() => {
    const ok = typeof window !== 'undefined' && !!window.speechSynthesis;
    setVozOk(ok);
    if (!ok) return;
    const carregar = () => {
      let todas = [];
      try { todas = window.speechSynthesis.getVoices() || []; } catch { todas = []; }
      const pt = todas.filter((v) => /^pt/i.test(v.lang || ''));
      if (!pt.length) return;
      setVozes(pt);
      setVozId((atual) => {
        if (atual && pt.some((v) => v.voiceURI === atual)) return atual;
        let salva = '';
        try { salva = localStorage.getItem(CHAVE_VOZ) || ''; } catch { /* ignora */ }
        if (salva && pt.some((v) => v.voiceURI === salva)) return salva;
        const br = pt.filter((v) => /pt[-_]BR/i.test(v.lang));
        const escolha = (br.find((v) => MASC.test(v.name || '')) || pt.find((v) => MASC.test(v.name || '')) || br[0] || pt[0]);
        return escolha ? escolha.voiceURI : '';
      });
    };
    carregar();
    window.speechSynthesis.addEventListener?.('voiceschanged', carregar);
    return () => {
      try { window.speechSynthesis.cancel(); } catch { /* ignora */ }
      window.speechSynthesis.removeEventListener?.('voiceschanged', carregar);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => { try { fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch { /* ignora */ } }, [conversa]);

  const trocarVoz = (id) => {
    setVozId(id);
    try { localStorage.setItem(CHAVE_VOZ, id); } catch { /* ignora */ }
  };

  // ---- A voz do Darci. No iPhone precisa vir de um toque — e vem. ----
  const falar = (texto) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(texto).replace(/R\$\s?/g, 'reais ').replace(/\s+/g, ' '));
      u.lang = 'pt-BR';
      u.rate = 1.0;
      // Se a voz escolhida JÁ é masculina (ex.: Felipe), fala no tom natural dela.
      // Só abaixa o tom quando a única opção é uma voz feminina/neutra.
      let ehMasculina = false;
      try {
        const todas = window.speechSynthesis.getVoices() || [];
        const v = todas.find((x) => x.voiceURI === vozIdRef.current);
        if (v) { u.voice = v; ehMasculina = MASC.test(v.name || ''); }
      } catch { /* usa a padrão */ }
      u.pitch = ehMasculina ? 1.0 : 0.82;
      u.onstart = () => setFalando(true);
      u.onend = () => setFalando(false);
      u.onerror = () => setFalando(false);
      window.speechSynthesis.speak(u);
    } catch { setFalando(false); }
  };
  const calar = () => { try { window.speechSynthesis.cancel(); } catch { /* ignora */ } setFalando(false); };

  // ---- Os números do bar (tudo vem dos dados reais) ----
  const n = useMemo(() => {
    const hoje = diaOperacional();
    const ontem = addDays(hoje, -1);
    const ym = ymOf(hoje);
    const totalCompra = (c) => num(c.quantidade) * num(c.valorUnit);

    // Caixa lançado na Finanças (mesmo critério do Log: sem "Recebimento Atrasado").
    const caixaDe = (d) => receitas.filter((r) => r && r.data === d && (r.categoria || '') !== ATRASADO).reduce((s, r) => s + num(r.valor), 0);
    const caixaOntem = caixaDe(ontem);
    const vendasOntem = vendas.filter((v) => (v.data || '') === ontem);
    const fiadoOntem = vendasOntem.reduce((s, v) => s + fiadoDaVenda(v), 0);

    // Mês corrente.
    const recMes = receitas.filter((r) => r && ymOf(r.data) === ym && (r.categoria || '') !== ATRASADO).reduce((s, r) => s + num(r.valor), 0);
    const despMes = despesas.filter((d) => d && ymOf(d.data) === ym).reduce((s, d) => s + num(d.valor), 0);
    const resultado = Math.round((recMes - despMes) * 100) / 100;
    const porCat = {};
    for (const d of despesas) if (d && ymOf(d.data) === ym) { const k = d.categoria || 'Outros'; porCat[k] = (porCat[k] || 0) + num(d.valor); }
    const maiorCat = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0] || null;

    // Fiado em aberto, por cliente.
    const aReceber = Math.round(vendas.reduce((s, v) => s + abertoDaVenda(v), 0) * 100) / 100;
    const mapa = new Map();
    for (const v of vendas) {
      const a = abertoDaVenda(v);
      if (a <= 0.005) continue;
      const k = limparNome(v.nome) || `Mesa ${v.mesa}`;
      mapa.set(k, (mapa.get(k) || 0) + a);
    }
    const devedores = [...mapa.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
    const noLimite = devedores.filter((d) => {
      const cli = clientes.find((c) => limparNome(c?.nome).toLowerCase() === d.nome.toLowerCase());
      const lim = cli ? num(cli.limite) : 0;
      return lim > 0 && d.total >= lim - 0.005;
    });

    // Estoque.
    const baixos = estoque.filter((it) => num(it.minimo) > 0 && num(it.saldo) <= num(it.minimo));
    const zerados = estoque.filter((it) => num(it.saldo) <= 0);
    const valorEstoque = estoque.reduce((s, it) => s + num(it.saldo) * num(it.custo), 0);

    // Contas a pagar.
    const abertas = compras.filter((c) => c && c.pago !== 'Sim' && c.vencimento);
    const vencidas = abertas.filter((c) => c.vencimento < hoje);
    const vence7 = abertas.filter((c) => c.vencimento >= hoje && c.vencimento <= addDays(hoje, 7));
    const somaC = (a) => Math.round(a.reduce((s, c) => s + totalCompra(c), 0) * 100) / 100;

    // O que mais vende (últimos 30 dias de comanda).
    const desde = addDays(hoje, -30);
    const prod = new Map();
    for (const v of vendas) {
      if ((v.data || '') < desde) continue;
      for (const it of (v.itens || [])) {
        const q = num(it.qtd);
        if (q <= 0) continue;
        const k = it.nome || '—';
        const cur = prod.get(k) || { nome: k, qtd: 0, total: 0 };
        cur.qtd += q; cur.total += q * num(it.preco);
        prod.set(k, cur);
      }
    }
    const topProdutos = [...prod.values()].sort((a, b) => b.total - a.total);
    const ticketOntem = vendasOntem.length ? vendasOntem.reduce((s, v) => s + num(v.total), 0) / vendasOntem.length : 0;

    return {
      hoje, ontem, caixaOntem, fiadoOntem, totalOntem: Math.round((caixaOntem + fiadoOntem) * 100) / 100,
      recMes, despMes, resultado, maiorCat, aReceber, devedores, noLimite,
      baixos, zerados, valorEstoque, vencidas, vence7, somaC,
      topProdutos, ticketOntem, pedidosOntem: vendasOntem.length,
      tarefasAbertas: tarefas.filter((t) => t && !t.feito),
    };
  }, [receitas, despesas, compras, vendas, estoque, tarefas, clientes]);

  // ---- O que ele mandaria fazer, por ordem de urgência ----
  const recomendacoes = () => {
    const r = [];
    if (n.vencidas.length) r.push(`tu tem ${plural(n.vencidas.length, 'conta vencida', 'contas vencidas')} somando ${brl(n.somaC(n.vencidas))}. Resolve isso hoje — juro só cresce e come tua margem.`);
    if (n.resultado < 0) r.push(`o mês está negativo em ${brl(Math.abs(n.resultado))}.${n.maiorCat ? ` Teu maior gasto é ${n.maiorCat[0]}, com ${brl(n.maiorCat[1])}. Ataca essa linha primeiro.` : ''}`);
    if (n.aReceber > 0 && n.recMes > 0 && n.aReceber / n.recMes > 0.25) r.push(`o fiado em aberto já é ${Math.round((n.aReceber / n.recMes) * 100)}% do que tu faturou no mês. Está alto. Prioriza cobrar ${lista(n.devedores.map((d) => d.nome), 2)}.`);
    if (n.noLimite.length) r.push(`${lista(n.noLimite.map((d) => d.nome), 3)} ${n.noLimite.length === 1 ? 'bateu' : 'bateram'} o limite de fiado. Não libera mais nada sem receber.`);
    if (n.zerados.length) r.push(`${plural(n.zerados.length, 'item zerado', 'itens zerados')} no estoque. Venda perdida é a mais cara que existe.`);
    else if (n.baixos.length) r.push(`${plural(n.baixos.length, 'item', 'itens')} abaixo do mínimo. Repõe antes do fim de semana.`);
    if (n.vence7.length) r.push(`${plural(n.vence7.length, 'conta vence', 'contas vencem')} nos próximos sete dias, ${brl(n.somaC(n.vence7))}. Deixa o caixa preparado.`);
    if (!r.length) {
      const top = n.topProdutos[0];
      r.push(`está tudo redondo. Foca em vender mais: ${top ? `teu carro-chefe é ${top.nome}` : 'trabalha teu carro-chefe'}.`);
    }
    return r;
  };

  const briefing = () => {
    const p = [];
    p.push('Ó, Karen.');
    if (n.caixaOntem > 0 || n.fiadoOntem > 0) {
      p.push(`Ontem entrou ${brl(n.caixaOntem)} no caixa${n.fiadoOntem > 0.005 ? `, e mais ${brl(n.fiadoOntem)} ficaram no fiado — o dia fechou em ${brl(n.totalOntem)}` : ''}.`);
    } else {
      p.push('Ontem ainda não tem caixa lançado.');
    }
    if (n.recMes > 0 || n.despMes > 0) {
      p.push(`No mês tu fez ${brl(n.recMes)} de receita e gastou ${brl(n.despMes)}. ${n.resultado >= 0 ? `Está positivo em ${brl(n.resultado)}` : `Está negativo em ${brl(Math.abs(n.resultado))}`}.`);
    }
    if (n.aReceber > 0.005) p.push(`Tem ${brl(n.aReceber)} pra receber de fiado${n.devedores[0] ? `, e o maior é ${n.devedores[0].nome}, com ${brl(n.devedores[0].total)}` : ''}.`);
    if (n.baixos.length) p.push(`${plural(n.baixos.length, 'item', 'itens')} abaixo do mínimo.`);
    const rec = recomendacoes();
    p.push(`O que eu faria primeiro: ${rec[0]}`);
    if (rec[1]) p.push(`Depois disso, ${rec[1]}`);
    return p.join(' ');
  };

  // ---- Entende a pergunta e responde com os dados reais ----
  const responder = (texto) => {
    const t = norm(texto);
    if (!t.trim()) return 'Pode falar. Me pergunta como foi ontem, quanto tu tem pra receber, o que está acabando, ou pede o briefing do dia.';

    if (tem(t, 'briefing', 'resumo', 'como estamos', 'como esta o bar', 'panorama', 'bom dia', 'me atualiza')) return briefing();

    if (tem(t, 'ontem', 'fechou ontem')) {
      if (!(n.caixaOntem > 0 || n.fiadoOntem > 0)) return 'Ontem ainda não tem caixa lançado na Finanças. Lança lá que eu te digo o número.';
      return `Ontem entrou ${brl(n.caixaOntem)} no caixa${n.fiadoOntem > 0.005 ? `, mais ${brl(n.fiadoOntem)} no fiado. O dia fechou em ${brl(n.totalOntem)}` : ''}.${n.pedidosOntem ? ` Foram ${plural(n.pedidosOntem, 'pedido', 'pedidos')}, ticket médio de ${brl(n.ticketOntem)}.` : ''}`;
    }

    if (tem(t, 'receber', 'fiado', 'devendo', 'deve', 'cobrar', 'devedor')) {
      if (n.aReceber <= 0.005) return 'Ninguém está te devendo. Fiado zerado — isso é ótimo pro teu caixa.';
      const top = n.devedores.slice(0, 4).map((d) => `${d.nome} ${brl(d.total)}`).join(', ');
      const alerta = n.noLimite.length ? ` E olha: ${lista(n.noLimite.map((d) => d.nome), 3)} já bateu o limite.` : '';
      return `Tu tem ${brl(n.aReceber)} pra receber, de ${plural(n.devedores.length, 'cliente', 'clientes')}. Os maiores: ${top}.${alerta} Cobrança se faz cedo, não na véspera.`;
    }

    if (tem(t, 'acabando', 'estoque', 'falta', 'faltando', 'repor', 'acabou', 'minimo')) {
      if (!n.baixos.length && !n.zerados.length) return `Está tranquilo, nada abaixo do mínimo. Tu tem ${brl(n.valorEstoque)} parado em mercadoria.`;
      const nomes = lista(n.baixos.map((it) => it.nome), 5);
      const zer = n.zerados.length ? ` E tem ${plural(n.zerados.length, 'item zerado', 'itens zerados')}.` : '';
      return `${plural(n.baixos.length, 'item', 'itens')} abaixo do mínimo: ${nomes}${n.baixos.length > 5 ? ', e mais alguns' : ''}.${zer} Repõe antes do fim de semana pra não perder venda.`;
    }

    if (tem(t, 'mes', 'mensal', 'lucro', 'prejuizo', 'resultado', 'sobrou', 'ganhando')) {
      if (n.recMes <= 0 && n.despMes <= 0) return 'Esse mês ainda não tem lançamento. Assim que tu lançar receita e despesa eu te digo o resultado.';
      const margem = n.recMes > 0 ? Math.round((n.resultado / n.recMes) * 100) : 0;
      return `No mês tu fez ${brl(n.recMes)} de receita e gastou ${brl(n.despMes)}. ${n.resultado >= 0 ? `Sobrou ${brl(n.resultado)}, margem de ${margem}%` : `Faltou ${brl(Math.abs(n.resultado))}`}.${n.maiorCat ? ` Teu maior gasto é ${n.maiorCat[0]}, ${brl(n.maiorCat[1])}.` : ''}`;
    }

    if (tem(t, 'conta', 'boleto', 'pagar', 'vencendo', 'vencer', 'vencida')) {
      if (!n.vencidas.length && !n.vence7.length) return 'Nenhuma conta vencida nem vencendo essa semana. Caixa livre.';
      const a = n.vencidas.length ? `Tu tem ${plural(n.vencidas.length, 'conta vencida', 'contas vencidas')}, ${brl(n.somaC(n.vencidas))}. ` : '';
      const b = n.vence7.length ? `${plural(n.vence7.length, 'conta vence', 'contas vencem')} nos próximos sete dias, ${brl(n.somaC(n.vence7))}.` : '';
      return `${a}${b} ${n.vencidas.length ? 'Paga ou negocia as vencidas hoje — juro só cresce.' : 'Deixa o caixa preparado.'}`;
    }

    if (tem(t, 'mais vende', 'mais vendido', 'top', 'carro-chefe', 'carro chefe', 'melhor produto', 'campeao')) {
      if (!n.topProdutos.length) return 'Ainda não tenho venda de comanda suficiente pra te dizer. Conforme tu for fechando comanda eu te falo.';
      const top = n.topProdutos.slice(0, 5).map((p) => `${p.nome}, ${plural(p.qtd, 'unidade', 'unidades')}`).join('; ');
      return `Nos últimos trinta dias, teus campeões: ${top}. O primeiro é teu carro-chefe: não deixa faltar e cuida bem da margem dele.`;
    }

    if (tem(t, 'faco hoje', 'o que fazer', 'prioridade', 'conselho', 'recomenda', 'foco', 'devo fazer')) {
      const r = recomendacoes();
      return `Tuas prioridades: ${r.slice(0, 3).map((x, i) => `${i + 1}. ${x}`).join(' ')}`;
    }

    if (tem(t, 'tarefa', 'pendencia', 'to do', 'todo')) {
      if (!n.tarefasAbertas.length) return 'Nenhuma tarefa em aberto. Lista limpa.';
      return `Tu tem ${plural(n.tarefasAbertas.length, 'tarefa', 'tarefas')} em aberto. As primeiras: ${lista(n.tarefasAbertas.map((t2) => t2.texto), 4)}.`;
    }

    if (tem(t, 'quanto tem em estoque', 'valor do estoque', 'parado', 'mercadoria')) {
      return `Tu tem ${brl(n.valorEstoque)} parado em mercadoria. Dinheiro em prateleira não rende — cuidado pra não comprar demais.`;
    }

    if (tem(t, 'obrigad', 'valeu', 'legal', 'otimo')) return 'Que isso. Estamos juntos — qualquer hora tu me chama.';
    if (tem(t, 'quem e voce', 'o que voce faz', 'seu nome', 'teu nome', 'darci')) {
      return 'Eu sou o Darci, teu sócio aqui dentro do PicoOS. Manezinho da ilha. Leio teus números o tempo todo — caixa, fiado, estoque, contas e vendas — e te digo, sem enrolação, onde está o dinheiro e onde está o problema.';
    }

    return 'Essa eu ainda não sei responder. Me pergunta assim: como foi ontem, quanto tenho a receber, o que está acabando, como está o mês, tenho conta pra pagar, o que mais vende, ou o que eu faço hoje.';
  };

  const enviar = (texto) => {
    const q = String(texto || '').trim();
    if (!q || pensando) return;
    setConversa((c) => [...c, { de: 'karen', texto: q }]);
    setPergunta('');
    setPensando(true);
    // Um respiro curto: a esfera "processa" antes de responder.
    timerRef.current = setTimeout(() => {
      const resp = responder(q);
      setPensando(false);
      setConversa((c) => [...c, { de: 'darci', texto: resp }]);
      falar(resp);
    }, 520);
  };

  const ativa = falando || pensando;
  const ATALHOS = ['Briefing do dia', 'Como foi ontem?', 'Quanto tenho a receber?', 'O que está acabando?', 'Como está o mês?', 'O que eu faço hoje?', 'O que mais vende?', 'Tenho conta pra pagar?'];

  return (
    <div>
      <style>{`
        @keyframes darci-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .darci-bolha { animation: darci-fade .25s ease both; }
        .darci-pt { display:inline-block; width:5px; height:5px; border-radius:999px; background:${C.accent}; margin-right:4px; animation: darci-blink 1s infinite; }
        .darci-pt:nth-child(2){ animation-delay:.15s } .darci-pt:nth-child(3){ animation-delay:.3s }
        @keyframes darci-blink { 0%,100%{opacity:.25} 50%{opacity:1} }
      `}</style>

      {/* A esfera de dados */}
      <div style={{ textAlign: 'center', paddingTop: 6, marginBottom: 6 }}>
        <OrbDarci ativo={ativa} tamanho={200} />
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '.06em', color: C.text, marginTop: -6 }}>DARCI</div>
        <div style={{ fontSize: 11.5, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, marginTop: 3 }}>
          {pensando ? 'processando…' : falando ? 'falando' : 'sócio · manezinho da ilha'}
        </div>
        {!vozOk && <div style={{ fontSize: 12, color: C.amber, marginTop: 8 }}>Neste aparelho a voz não funciona — ele responde escrito.</div>}
        {vozOk && vozes.length > 1 && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: C.faint, fontWeight: 700 }}>Voz</span>
            <select value={vozId} onChange={(e) => trocarVoz(e.target.value)}
              style={{ ...inputStyle, width: 'auto', maxWidth: 210, padding: '7px 10px', fontSize: 12.5 }}>
              {vozes.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
            </select>
            <button onClick={() => falar('Ó, Karen. Sou o Darci, teu sócio aqui do Pico.')}
              style={{ background: 'none', border: `1px solid ${C.line}`, color: C.accent, borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>testar</button>
          </div>
        )}
      </div>

      {/* Conversa */}
      {conversa.length === 0 ? (
        <Card style={{ margin: '16px 0 14px', borderColor: C.accent }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Bora começar pelo briefing</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
            Toca aí embaixo que eu te conto em voz alta como está o bar: ontem, o mês, o fiado, o estoque e o que tu tem que fazer primeiro.
          </div>
          <Btn onClick={() => enviar('Briefing do dia')}>Ouvir o briefing do dia</Btn>
        </Card>
      ) : (
        <div style={{ margin: '16px 0 14px' }}>
          {conversa.map((m, i) => (
            <div key={i} className="darci-bolha" style={{ display: 'flex', justifyContent: m.de === 'karen' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{
                maxWidth: '88%', borderRadius: 16, padding: '11px 14px', fontSize: 14, lineHeight: 1.5,
                background: m.de === 'karen' ? C.accent : C.panel,
                color: m.de === 'karen' ? '#06101F' : C.text,
                border: m.de === 'karen' ? 'none' : `1px solid ${C.cardBorder}`,
                fontWeight: m.de === 'karen' ? 700 : 400,
              }}>
                {m.de === 'darci' && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.10em', color: C.accent, marginBottom: 5 }}>DARCI</div>}
                {m.texto}
                {m.de === 'darci' && vozOk && (
                  <button onClick={() => falar(m.texto)} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>ouvir de novo</button>
                )}
              </div>
            </div>
          ))}
          {pensando && (
            <div className="darci-bolha" style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ borderRadius: 16, padding: '12px 16px', background: C.panel, border: `1px solid ${C.cardBorder}` }}>
                <span className="darci-pt" /><span className="darci-pt" /><span className="darci-pt" />
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>
      )}

      {falando && (
        <div style={{ marginBottom: 10 }}>
          <Btn kind="danger" small onClick={calar}>Parar de falar</Btn>
        </div>
      )}

      {/* Pergunta */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') enviar(pergunta); }}
            placeholder="Pergunta pro Darci… (ou usa o microfone do teclado)"
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
          />
          <MicBtn value={pergunta} onChange={setPergunta} />
          <Btn onClick={() => enviar(pergunta)}>Perguntar</Btn>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
          {ATALHOS.map((a) => (
            <button key={a} onClick={() => enviar(a)} style={{
              border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, borderRadius: 999,
              padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{a}</button>
          ))}
        </div>
      </Card>

      <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5 }}>
        O Darci só fala do que está registrado no PicoOS. Se um número parecer estranho, provavelmente falta lançar alguma coisa.
      </div>
    </div>
  );
}
