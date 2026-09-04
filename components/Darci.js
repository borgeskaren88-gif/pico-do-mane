'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { C, Card, Btn, inputStyle } from './ui';
import MicBtn from './MicBtn';
import OrbDarci from './OrbDarci';
import { num, brl, addDays, ymOf, limparNome, fiadoDaVenda, abertoDaVenda, diaOperacional } from '../lib/util';

// DARCI: a sócia manezinha do PicoOS. Conhece os números do bar de cabeça e
// conversa com a Karen por voz, com sotaque da ilha. Ela NÃO inventa nada — tudo
// que fala sai dos dados do próprio sistema (caixa, fiado, estoque, contas,
// vendas). Fala em voz alta e aceita pergunta por voz ou digitada.

const ATRASADO = 'Recebimento Atrasado';
// Tira acento e caixa, pra casar a pergunta sem depender de como ela escreveu.
const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tem = (t, ...palavras) => palavras.some((p) => t.includes(p));
const lista = (arr, n = 3) => arr.slice(0, n).join(', ');

const ATALHOS = [
  'Briefing do dia',
  'Como foi ontem?',
  'Quanto tenho a receber?',
  'O que está acabando?',
  'Como está o mês?',
  'O que eu faço hoje?',
  'O que mais vende?',
  'Tenho conta pra pagar?',
];

export default function Darci({ receitas = [], despesas = [], compras = [], vendas = [], estoque = [], tarefas = [], clientes = [] }) {
  const [pergunta, setPergunta] = useState('');
  const [conversa, setConversa] = useState([]); // { de:'karen'|'darci', texto }
  const [falando, setFalando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [vozOk, setVozOk] = useState(false);
  const fimRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const ok = typeof window !== 'undefined' && !!window.speechSynthesis;
    setVozOk(ok);
    if (!ok) return;
    // Algumas plataformas só carregam as vozes depois; forçamos a leitura.
    const carregar = () => { try { window.speechSynthesis.getVoices(); } catch { /* ignora */ } };
    carregar();
    window.speechSynthesis.addEventListener?.('voiceschanged', carregar);
    return () => {
      try { window.speechSynthesis.cancel(); } catch { /* ignora */ }
      window.speechSynthesis.removeEventListener?.('voiceschanged', carregar);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => { try { fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch { /* ignora */ } }, [conversa]);

  // ---- A voz da Darci (pt-BR). No iPhone precisa vir de um toque — e vem. ----
  const falar = (texto) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(texto).replace(/R\$\s?/g, 'reais ').replace(/\s+/g, ' '));
      u.lang = 'pt-BR';
      u.rate = 1.0;
      u.pitch = 1.06; // um tom levemente mais leve, pra soar mais ela
      const vozes = window.speechSynthesis.getVoices() || [];
      // Prefere uma voz feminina de pt-BR quando o aparelho tiver.
      const ptBR = vozes.filter((v) => /pt[-_]BR/i.test(v.lang));
      const fem = ptBR.find((v) => /luciana|fernanda|female|f[eé]minin/i.test(v.name || ''));
      const escolhida = fem || ptBR[0] || vozes.find((v) => /^pt/i.test(v.lang));
      if (escolhida) u.voice = escolhida;
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
    const somaC = (arr) => Math.round(arr.reduce((s, c) => s + totalCompra(c), 0) * 100) / 100;

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

  // ---- O que a Darci mandaria fazer, por ordem de urgência ----
  const recomendacoes = () => {
    const r = [];
    if (n.vencidas.length) r.push(`tu tem ${n.vencidas.length} conta vencida somando ${brl(n.somaC(n.vencidas))}. Resolve isso hoje, que juro é brabo e come tua margem.`);
    if (n.resultado < 0) r.push(`o mês tá negativo em ${brl(Math.abs(n.resultado))}.${n.maiorCat ? ` Teu maior gasto é ${n.maiorCat[0]}, com ${brl(n.maiorCat[1])}. Ataca essa linha primeiro.` : ''}`);
    if (n.aReceber > 0 && n.recMes > 0 && n.aReceber / n.recMes > 0.25) r.push(`o fiado em aberto já é ${Math.round((n.aReceber / n.recMes) * 100)} por cento do que tu faturou no mês. Tá alto, guria. Prioriza cobrar ${lista(n.devedores.map((d) => d.nome), 2)}.`);
    if (n.noLimite.length) r.push(`${lista(n.noLimite.map((d) => d.nome), 3)} bateu o limite de fiado. Não libera mais nada sem receber, tá ligada?`);
    if (n.zerados.length) r.push(`${n.zerados.length} item zerado no estoque. Venda perdida é a mais cara que tem, ó.`);
    else if (n.baixos.length) r.push(`${n.baixos.length} item abaixo do mínimo. Repõe antes do fim de semana pra não te faltar nada.`);
    if (n.vence7.length) r.push(`${n.vence7.length} conta vence nos próximo sete dia, ${brl(n.somaC(n.vence7))}. Deixa o caixa preparado.`);
    if (!r.length) {
      const top = n.topProdutos[0];
      r.push(`tá tudo redondo, guria. Foca em vender mais: ${top ? `teu carro-chefe é ${top.nome}, dá-lhe nele` : 'empurra teu carro-chefe'}.`);
    }
    return r;
  };

  const briefing = () => {
    const p = [];
    p.push(`Ó, Karen, teu resumo.`);
    if (n.caixaOntem > 0 || n.fiadoOntem > 0) {
      p.push(`Ontem entrou ${brl(n.caixaOntem)} no caixa${n.fiadoOntem > 0.005 ? `, e mais ${brl(n.fiadoOntem)} ficaram no fiado, fechando o dia em ${brl(n.totalOntem)}` : ''}.`);
    } else {
      p.push(`Ontem ainda não tem caixa lançado, ó.`);
    }
    if (n.recMes > 0 || n.despMes > 0) {
      p.push(`No mês tu fez ${brl(n.recMes)} de receita e gastou ${brl(n.despMes)}. ${n.resultado >= 0 ? `Tá positivo em ${brl(n.resultado)}` : `Tá negativo em ${brl(Math.abs(n.resultado))}`}.`);
    }
    if (n.aReceber > 0.005) p.push(`Tem ${brl(n.aReceber)} pra receber de fiado${n.devedores[0] ? `. O maior é ${n.devedores[0].nome}, com ${brl(n.devedores[0].total)}` : ''}.`);
    if (n.baixos.length) p.push(`${n.baixos.length} item abaixo do mínimo.`);
    const rec = recomendacoes();
    p.push(`Ó o que eu faria primeiro: ${rec[0]}`);
    if (rec[1]) p.push(`Depois disso, ${rec[1]}`);
    return p.join(' ');
  };

  // ---- Entende a pergunta e responde com os dados reais ----
  const responder = (texto) => {
    const t = norm(texto);
    if (!t.trim()) return 'Ó, pode falar, guria. Me pergunta como foi ontem, quanto tu tem pra receber, o que tá acabando, ou pede o briefing do dia.';

    if (tem(t, 'briefing', 'resumo', 'como estamos', 'como esta o bar', 'panorama', 'bom dia', 'me atualiza')) return briefing();

    if (tem(t, 'ontem', 'fechou ontem')) {
      if (!(n.caixaOntem > 0 || n.fiadoOntem > 0)) return 'Ontem ainda não tem caixa lançado na Finanças, guria. Lança lá que eu já te digo o número.';
      return `Ó, ontem entrou ${brl(n.caixaOntem)} no caixa${n.fiadoOntem > 0.005 ? `, mais ${brl(n.fiadoOntem)} no fiado. O dia fechou em ${brl(n.totalOntem)}` : ''}.${n.pedidosOntem ? ` Foram ${n.pedidosOntem} pedido, ticket médio de ${brl(n.ticketOntem)}.` : ''}`;
    }

    if (tem(t, 'receber', 'fiado', 'devendo', 'deve', 'cobrar', 'devedor')) {
      if (n.aReceber <= 0.005) return 'Capaz! Ninguém tá te devendo. Fiado zerado, isso é bom demais pro teu caixa.';
      const top = n.devedores.slice(0, 4).map((d) => `${d.nome} ${brl(d.total)}`).join(', ');
      const alerta = n.noLimite.length ? ` E ó: ${lista(n.noLimite.map((d) => d.nome), 3)} já bateu o limite.` : '';
      return `Ó, tu tem ${brl(n.aReceber)} pra receber, de ${n.devedores.length} cliente. Os maiores: ${top}.${alerta} Cobrança se faz cedo, guria, não na véspera.`;
    }

    if (tem(t, 'acabando', 'estoque', 'falta', 'faltando', 'repor', 'acabou', 'minimo')) {
      if (!n.baixos.length && !n.zerados.length) return `Tá tudo tranquilo, nada abaixo do mínimo. Tu tem ${brl(n.valorEstoque)} parado em mercadoria.`;
      const nomes = lista(n.baixos.map((it) => it.nome), 5);
      const zer = n.zerados.length ? ` E tem ${n.zerados.length} item zerado, ó.` : '';
      return `Ó, ${n.baixos.length} item abaixo do mínimo: ${nomes}${n.baixos.length > 5 ? ', e mais uns outros' : ''}.${zer} Repõe antes do fim de semana pra não perder venda.`;
    }

    if (tem(t, 'mes', 'mensal', 'lucro', 'prejuizo', 'resultado', 'sobrou', 'ganhando')) {
      if (n.recMes <= 0 && n.despMes <= 0) return 'Esse mês ainda não tem lançamento nenhum, guria. Assim que tu lançar receita e despesa eu te digo o resultado.';
      const margem = n.recMes > 0 ? Math.round((n.resultado / n.recMes) * 100) : 0;
      return `No mês tu fez ${brl(n.recMes)} de receita e gastou ${brl(n.despMes)}. ${n.resultado >= 0 ? `Sobrou ${brl(n.resultado)}, uma margem de ${margem} por cento` : `Faltou ${brl(Math.abs(n.resultado))}`}.${n.maiorCat ? ` Teu maior gasto é ${n.maiorCat[0]}, ${brl(n.maiorCat[1])}.` : ''}`;
    }

    if (tem(t, 'conta', 'boleto', 'pagar', 'vencendo', 'vencer', 'vencida')) {
      if (!n.vencidas.length && !n.vence7.length) return 'Nenhuma conta vencida nem vencendo essa semana. Caixa livre, ó.';
      const a = n.vencidas.length ? `${n.vencidas.length} conta vencida, ${brl(n.somaC(n.vencidas))}. ` : '';
      const b = n.vence7.length ? `${n.vence7.length} vence nos próximo sete dia, ${brl(n.somaC(n.vence7))}.` : '';
      return `Ó, ${a}${b} ${n.vencidas.length ? 'Paga ou negocia as vencida hoje, que juro é brabo.' : 'Deixa o caixa preparado.'}`;
    }

    if (tem(t, 'mais vende', 'mais vendido', 'top', 'carro-chefe', 'carro chefe', 'melhor produto', 'campeao')) {
      if (!n.topProdutos.length) return 'Ainda não tenho venda de comanda que chegue pra te dizer. Conforme tu for fechando comanda eu te falo.';
      const top = n.topProdutos.slice(0, 5).map((p) => `${p.nome}, ${p.qtd} unidade`).join('; ');
      return `Nos último trinta dia, teus campeões: ${top}. O primeiro é teu carro-chefe — não deixa faltar e cuida bem da margem dele.`;
    }

    if (tem(t, 'faco hoje', 'o que fazer', 'prioridade', 'conselho', 'recomenda', 'foco', 'devo fazer')) {
      const r = recomendacoes();
      return `Ó, tuas prioridades: ${r.slice(0, 3).map((x, i) => `${i + 1}. ${x}`).join(' ')}`;
    }

    if (tem(t, 'tarefa', 'pendencia', 'to do', 'todo')) {
      if (!n.tarefasAbertas.length) return 'Nenhuma tarefa em aberto, guria. Lista limpa.';
      return `Tu tem ${n.tarefasAbertas.length} tarefa em aberto. As primeiras: ${lista(n.tarefasAbertas.map((t2) => t2.texto), 4)}.`;
    }

    if (tem(t, 'quanto tem em estoque', 'valor do estoque', 'parado', 'mercadoria')) {
      return `Tu tem ${brl(n.valorEstoque)} parado em mercadoria. Dinheiro em prateleira não rende, ó — cuidado pra não comprar demais.`;
    }

    if (tem(t, 'obrigad', 'valeu', 'legal', 'otimo')) return 'Que isso, guria. Tamo junto. Qualquer hora tu me chama.';
    if (tem(t, 'quem e voce', 'o que voce faz', 'seu nome', 'teu nome', 'darci')) {
      return 'Ó, eu sou a Darci, tua sócia aqui dentro do PicoOS. Manezinha da ilha, criada ali pelas banda do Pico. Eu leio teus número o tempo todo — caixa, fiado, estoque, conta e venda — e te digo, sem enrolação, onde tá o dinheiro e onde tá o problema.';
    }

    return 'Essa aí eu ainda não sei responder, guria. Me pergunta assim: como foi ontem, quanto tenho a receber, o que tá acabando, como está o mês, tenho conta pra pagar, o que mais vende, ou o que eu faço hoje.';
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
          {pensando ? 'processando…' : falando ? 'falando' : 'sócia · manezinha da ilha'}
        </div>
        {!vozOk && <div style={{ fontSize: 12, color: C.amber, marginTop: 8 }}>Neste aparelho a voz não funciona — ela responde escrito.</div>}
      </div>

      {/* Conversa */}
      {conversa.length === 0 ? (
        <Card style={{ margin: '16px 0 14px', borderColor: C.accent }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Ó, bora começar pelo briefing</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
            Toca aí embaixo que eu te conto em voz alta como tá o bar: ontem, o mês, o fiado, o estoque e o que tu tem que fazer primeiro.
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
            placeholder="Pergunta pra Darci… (ou usa o microfone do teclado)"
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
        A Darci só fala do que está registrado no PicoOS. Se um número parecer estranho, provavelmente falta lançar alguma coisa.
      </div>
    </div>
  );
}
