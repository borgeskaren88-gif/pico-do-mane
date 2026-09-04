'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { C, Card, Btn, PageTitle, inputStyle } from './ui';
import MicBtn from './MicBtn';
import { num, brl, addDays, ymOf, limparNome, fiadoDaVenda, abertoDaVenda, diaOperacional } from '../lib/util';

// CEO: um sócio que conhece os números do bar e conversa com a dona por voz.
// Ele NÃO inventa nada — tudo que fala sai dos dados do próprio PicoOS
// (caixa, fiado, estoque, contas, vendas). Fala em voz alta (o iPhone lê bem)
// e aceita pergunta por voz (microfone do teclado) ou digitada.

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

export default function Ceo({ receitas = [], despesas = [], compras = [], vendas = [], estoque = [], tarefas = [], clientes = [] }) {
  const [pergunta, setPergunta] = useState('');
  const [conversa, setConversa] = useState([]); // { de:'karen'|'ceo', texto }
  const [falando, setFalando] = useState(false);
  const [vozOk, setVozOk] = useState(false);
  const fimRef = useRef(null);

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
    };
  }, []);

  useEffect(() => { try { fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch { /* ignora */ } }, [conversa]);

  // ---- Fala em voz alta (pt-BR). No iPhone precisa vir de um toque — e vem. ----
  const falar = (texto) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(texto).replace(/R\$\s?/g, 'reais ').replace(/\s+/g, ' '));
      u.lang = 'pt-BR';
      u.rate = 1.03;
      u.pitch = 1;
      const vozes = window.speechSynthesis.getVoices() || [];
      const pt = vozes.find((v) => /pt[-_]BR/i.test(v.lang)) || vozes.find((v) => /^pt/i.test(v.lang));
      if (pt) u.voice = pt;
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

  // ---- As recomendações do CEO, por ordem de urgência ----
  const recomendacoes = () => {
    const r = [];
    if (n.vencidas.length) r.push(`Você tem ${n.vencidas.length} conta vencida somando ${brl(n.somaC(n.vencidas))}. Resolve isso hoje, porque juro come margem.`);
    if (n.resultado < 0) r.push(`O mês está negativo em ${brl(Math.abs(n.resultado))}.${n.maiorCat ? ` Seu maior gasto é ${n.maiorCat[0]}, com ${brl(n.maiorCat[1])}. Ataca essa linha primeiro.` : ''}`);
    if (n.aReceber > 0 && n.recMes > 0 && n.aReceber / n.recMes > 0.25) r.push(`O fiado em aberto já é ${Math.round((n.aReceber / n.recMes) * 100)} por cento do que você faturou no mês. Está alto. Prioriza cobrar ${lista(n.devedores.map((d) => d.nome), 2)}.`);
    if (n.noLimite.length) r.push(`${lista(n.noLimite.map((d) => d.nome), 3)} ${n.noLimite.length === 1 ? 'bateu' : 'bateram'} o limite de fiado. Não libera mais sem receber.`);
    if (n.zerados.length) r.push(`${n.zerados.length} item zerado no estoque. Venda perdida é a mais cara que existe.`);
    else if (n.baixos.length) r.push(`${n.baixos.length} item abaixo do mínimo. Repõe antes do fim de semana.`);
    if (n.vence7.length) r.push(`${n.vence7.length} conta vence nos próximos sete dias, ${brl(n.somaC(n.vence7))}. Deixa o caixa preparado.`);
    if (!r.length) {
      const top = n.topProdutos[0];
      r.push(`Os números estão saudáveis. Foca em vender mais: ${top ? `seu carro-chefe é ${top.nome}` : 'trabalhe seu carro-chefe'}. Empurra ele.`);
    }
    return r;
  };

  const briefing = () => {
    const p = [];
    p.push(`Karen, seu resumo.`);
    if (n.caixaOntem > 0 || n.fiadoOntem > 0) {
      p.push(`Ontem entrou ${brl(n.caixaOntem)} no caixa${n.fiadoOntem > 0.005 ? `, e mais ${brl(n.fiadoOntem)} ficaram no fiado, fechando o dia em ${brl(n.totalOntem)}` : ''}.`);
    } else {
      p.push(`Ontem não tem caixa lançado ainda.`);
    }
    if (n.recMes > 0 || n.despMes > 0) {
      p.push(`No mês: ${brl(n.recMes)} de receita e ${brl(n.despMes)} de despesa. ${n.resultado >= 0 ? `Está positivo em ${brl(n.resultado)}` : `Está negativo em ${brl(Math.abs(n.resultado))}`}.`);
    }
    if (n.aReceber > 0.005) p.push(`Tem ${brl(n.aReceber)} pra receber de fiado${n.devedores[0] ? `. O maior é ${n.devedores[0].nome}, com ${brl(n.devedores[0].total)}` : ''}.`);
    if (n.baixos.length) p.push(`${n.baixos.length} item abaixo do mínimo.`);
    const rec = recomendacoes();
    p.push(`Minha recomendação: ${rec[0]}`);
    if (rec[1]) p.push(`Depois disso: ${rec[1]}`);
    return p.join(' ');
  };

  // ---- Entende a pergunta e responde com os dados reais ----
  const responder = (texto) => {
    const t = norm(texto);
    if (!t.trim()) return 'Pode falar. Me pergunta como foi ontem, quanto você tem pra receber, o que está acabando, ou peça o briefing do dia.';

    if (tem(t, 'briefing', 'resumo', 'como estamos', 'como está o bar', 'como esta o bar', 'panorama', 'bom dia', 'me atualiza')) return briefing();

    if (tem(t, 'ontem', 'ontem foi', 'fechou ontem')) {
      if (!(n.caixaOntem > 0 || n.fiadoOntem > 0)) return 'Ontem ainda não tem caixa lançado na Finanças. Lança que eu te dou o número.';
      return `Ontem entrou ${brl(n.caixaOntem)} no caixa${n.fiadoOntem > 0.005 ? `, mais ${brl(n.fiadoOntem)} no fiado. O dia fechou em ${brl(n.totalOntem)}` : ''}.${n.pedidosOntem ? ` Foram ${n.pedidosOntem} pedidos, ticket médio de ${brl(n.ticketOntem)}.` : ''}`;
    }

    if (tem(t, 'receber', 'fiado', 'devendo', 'deve', 'cobrar', 'devedor')) {
      if (n.aReceber <= 0.005) return 'Ninguém está devendo. Fiado zerado, isso é ótimo pro seu caixa.';
      const top = n.devedores.slice(0, 4).map((d) => `${d.nome} ${brl(d.total)}`).join(', ');
      const alerta = n.noLimite.length ? ` Atenção: ${lista(n.noLimite.map((d) => d.nome), 3)} já bateu o limite.` : '';
      return `Você tem ${brl(n.aReceber)} pra receber, de ${n.devedores.length} cliente. Os maiores: ${top}.${alerta} Cobrança se faz cedo, não na véspera.`;
    }

    if (tem(t, 'acabando', 'estoque', 'falta', 'faltando', 'repor', 'acabou', 'minimo', 'mínimo')) {
      if (!n.baixos.length && !n.zerados.length) return `Estoque tranquilo, nada abaixo do mínimo. Você tem ${brl(n.valorEstoque)} parados em mercadoria.`;
      const nomes = lista(n.baixos.map((it) => it.nome), 5);
      const zer = n.zerados.length ? ` E tem ${n.zerados.length} item zerado.` : '';
      return `${n.baixos.length} item abaixo do mínimo: ${nomes}${n.baixos.length > 5 ? ', e mais outros' : ''}.${zer} Repõe antes do fim de semana pra não perder venda.`;
    }

    if (tem(t, 'mes', 'mês', 'mensal', 'lucro', 'prejuizo', 'prejuízo', 'resultado', 'sobrou', 'ganhando')) {
      if (n.recMes <= 0 && n.despMes <= 0) return 'Esse mês ainda não tem lançamento. Assim que você lançar receita e despesa eu te falo o resultado.';
      const margem = n.recMes > 0 ? Math.round((n.resultado / n.recMes) * 100) : 0;
      return `No mês você fez ${brl(n.recMes)} de receita e gastou ${brl(n.despMes)}. ${n.resultado >= 0 ? `Sobrou ${brl(n.resultado)}, uma margem de ${margem} por cento` : `Faltou ${brl(Math.abs(n.resultado))}`}.${n.maiorCat ? ` Seu maior gasto é ${n.maiorCat[0]}, ${brl(n.maiorCat[1])}.` : ''}`;
    }

    if (tem(t, 'conta', 'boleto', 'pagar', 'vencendo', 'vencer', 'vencida')) {
      if (!n.vencidas.length && !n.vence7.length) return 'Nenhuma conta vencida nem vencendo essa semana. Caixa livre.';
      const a = n.vencidas.length ? `${n.vencidas.length} conta vencida, ${brl(n.somaC(n.vencidas))}. ` : '';
      const b = n.vence7.length ? `${n.vence7.length} vence nos próximos sete dias, ${brl(n.somaC(n.vence7))}.` : '';
      return `${a}${b} ${n.vencidas.length ? 'Paga ou negocia as vencidas hoje.' : 'Deixa o caixa preparado.'}`;
    }

    if (tem(t, 'mais vende', 'mais vendido', 'top', 'carro-chefe', 'carro chefe', 'melhor produto', 'campeao', 'campeão')) {
      if (!n.topProdutos.length) return 'Ainda não tenho venda de comanda suficiente pra dizer. Conforme for fechando comanda eu te falo.';
      const top = n.topProdutos.slice(0, 5).map((p) => `${p.nome}, ${p.qtd} unidades`).join('; ');
      return `Nos últimos trinta dias, seus campeões: ${top}. O primeiro é seu carro-chefe — garante que nunca falte e cuida da margem dele.`;
    }

    if (tem(t, 'faco hoje', 'faço hoje', 'o que fazer', 'prioridade', 'conselho', 'recomenda', 'foco', 'devo fazer')) {
      const r = recomendacoes();
      return `Suas prioridades: ${r.slice(0, 3).map((x, i) => `${i + 1}. ${x}`).join(' ')}`;
    }

    if (tem(t, 'tarefa', 'pendencia', 'pendência', 'to do', 'todo')) {
      if (!n.tarefasAbertas.length) return 'Nenhuma tarefa em aberto. Lista limpa.';
      return `Você tem ${n.tarefasAbertas.length} tarefa em aberto. As primeiras: ${lista(n.tarefasAbertas.map((t2) => t2.texto), 4)}.`;
    }

    if (tem(t, 'quanto tem em estoque', 'valor do estoque', 'parado', 'mercadoria')) {
      return `Você tem ${brl(n.valorEstoque)} parados em mercadoria. Dinheiro em prateleira não rende — cuidado pra não comprar demais.`;
    }

    if (tem(t, 'obrigad', 'valeu', 'legal', 'otimo', 'ótimo')) return 'Estamos juntos. Qualquer hora me chama.';
    if (tem(t, 'quem e voce', 'quem é você', 'o que voce faz', 'o que você faz')) return 'Sou seu sócio dentro do PicoOS. Eu leio seus números o tempo todo — caixa, fiado, estoque, contas e vendas — e te digo, sem enrolação, onde está o dinheiro e onde está o problema.';

    return `Ainda não sei responder isso. Me pergunta assim: como foi ontem, quanto tenho a receber, o que está acabando, como está o mês, tenho conta pra pagar, o que mais vende, ou o que eu faço hoje.`;
  };

  const enviar = (texto) => {
    const q = String(texto || '').trim();
    if (!q) return;
    const resp = responder(q);
    setConversa((c) => [...c, { de: 'karen', texto: q }, { de: 'ceo', texto: resp }]);
    setPergunta('');
    falar(resp);
  };

  return (
    <div>
      <PageTitle sub="Seu sócio que conhece os números e fala com você">CEO</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          Pergunte por <b style={{ color: C.text }}>voz</b> (toque no microfone do teclado) ou digitando. Ele responde <b style={{ color: C.text }}>falando</b>, usando os seus números de verdade — caixa, fiado, estoque, contas e vendas.
          {!vozOk && <span style={{ color: C.amber }}> (Neste aparelho a fala não está disponível — as respostas aparecem escritas.)</span>}
        </div>
      </Card>

      {/* Conversa */}
      {conversa.length === 0 ? (
        <Card style={{ marginBottom: 14, borderColor: C.accent }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>Comece pelo briefing</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
            Toque abaixo e eu te dou o panorama do bar em voz alta: ontem, o mês, o fiado, o estoque e o que fazer primeiro.
          </div>
          <Btn onClick={() => enviar('Briefing do dia')}>Ouvir o briefing do dia</Btn>
        </Card>
      ) : (
        <div style={{ marginBottom: 14 }}>
          {conversa.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.de === 'karen' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{
                maxWidth: '88%', borderRadius: 14, padding: '11px 14px', fontSize: 14, lineHeight: 1.5,
                background: m.de === 'karen' ? C.accent : C.panel,
                color: m.de === 'karen' ? '#06101F' : C.text,
                border: m.de === 'karen' ? 'none' : `1px solid ${C.cardBorder}`,
                fontWeight: m.de === 'karen' ? 700 : 400,
              }}>
                {m.de === 'ceo' && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: C.accent, marginBottom: 5 }}>CEO</div>}
                {m.texto}
                {m.de === 'ceo' && vozOk && (
                  <button onClick={() => falar(m.texto)} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: C.accent, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: 0 }}>ouvir de novo</button>
                )}
              </div>
            </div>
          ))}
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
            placeholder="Pergunte algo… (ou use o microfone do teclado)"
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
        O CEO só fala do que está registrado no PicoOS. Se um número parecer errado, provavelmente falta lançar algo — me chame que a gente confere.
      </div>
    </div>
  );
}
