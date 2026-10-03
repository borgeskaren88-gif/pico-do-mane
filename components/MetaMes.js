'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, NumInput, Field } from './ui';
import { brl, num, ymOf, todayISO, mesLabel } from '../lib/util';
import { calcularMeta, diasSemanaDoMovimento, diasDeOperacao } from '../lib/meta';

const TAB = { fontVariantNumeric: 'tabular-nums' };
const DIAS = [['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]];
const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// "qua, qui, sex, sáb e dom" — do jeito que se fala.
const listar = (ds) => {
  const n = (ds || []).map((d) => CURTOS[d]);
  if (!n.length) return 'nenhum dia';
  if (n.length === 1) return n[0];
  return `${n.slice(0, -1).join(', ')} e ${n[n.length - 1]}`;
};

// Cor e recado de cada estado. O verde não é decoração: é a resposta à única
// pergunta que ela faz olhando o Dashboard — "estou bem ou estou mal?".
const ESTADOS = {
  'sem-meta': { cor: C.faint, titulo: '' },
  comecando: { cor: C.accent, titulo: 'Mês começando' },
  adiantada: { cor: C.green, titulo: 'Adiantada' },
  'no-ritmo': { cor: C.green, titulo: 'No ritmo' },
  atras: { cor: C.amber, titulo: 'Um pouco atrás' },
  'muito-atras': { cor: C.red, titulo: 'Atrás do ritmo' },
  bateu: { cor: C.green, titulo: 'Meta batida' },
  'fechou-abaixo': { cor: C.red, titulo: 'Mês fechou abaixo' },
};

// O RELÓGIO DA META.
//
// O cartão da meta ocupava meia tela e ela olha pra ele todo dia: "não queria
// algo tão grande, podia ser um quadrado arredondado, como se fosse um relógio,
// subindo conforme a venda". Então o que decide — onde eu estou e onde eu
// DEVIA estar — virou um mostrador; o resto continua aqui dentro, a um toque.
//
// O risco no anel é a parte que ninguém pede e todo mundo usa: estar com a
// cor passando do risco é estar adiantada, sem precisar entender conta nenhuma.
function Relogio({ pct, pace, cor, tamanho = 76 }) {
  const r = (tamanho - 10) / 2;
  const volta = 2 * Math.PI * r;
  const cheio = Math.max(0, Math.min(1, pct));
  const ang = (Math.max(0, Math.min(1, pace)) * 360) - 90;
  const rad = (ang * Math.PI) / 180;
  const c = tamanho / 2;
  const x1 = c + Math.cos(rad) * (r - 6);
  const y1 = c + Math.sin(rad) * (r - 6);
  const x2 = c + Math.cos(rad) * (r + 6);
  const y2 = c + Math.sin(rad) * (r + 6);
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} style={{ flexShrink: 0, display: 'block' }} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke={C.panel2} strokeWidth="8" />
      <circle
        cx={c} cy={c} r={r} fill="none" stroke={cor} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={volta} strokeDashoffset={volta * (1 - cheio)}
        transform={`rotate(-90 ${c} ${c})`}
        // Sobe andando, não pulando: o movimento é o que faz parecer relógio.
        style={{ transition: 'stroke-dashoffset .6s ease-out' }}
      />
      {pace > 0 && pace < 1 && (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.text} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      )}
      <text x={c} y={c + 5} textAnchor="middle" fill={cor} fontSize="16" fontWeight="900" fontFamily="system-ui, sans-serif">
        {Math.round(cheio * 100)}%
      </text>
    </svg>
  );
}

// canto: o relógio encaixado no canto do cabeçalho, embaixo do Darci. Um
// quadrado pequeno, e o detalhe abre por cima — em vez de ocupar meia tela.
export default function MetaMes({ metas, receitas = [], realizado = 0, oculto = (t) => t, onSalvar, canto = false }) {
  const hoje = todayISO();
  const mes = ymOf(hoje);
  const [editando, setEditando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  const [soEsteMes, setSoEsteMes] = useState(false);
  const [dias, setDias] = useState(null);

  // O caixa do dia é lançado no fim da noite. Enquanto não for, hoje não conta
  // como dia já vendido — senão a tela acusaria atraso às dez da manhã.
  const temReceitaHoje = useMemo(
    () => receitas.some((r) => r && r.data === hoje && num(r.valor) > 0),
    [receitas, hoje],
  );
  // Os dias DESTE mês em que entrou dinheiro. Dia com caixa lançado é dia que o
  // bar abriu — mesmo que a marcação da semana diga o contrário.
  const diasComReceita = useMemo(
    () => [...new Set(receitas.filter((r) => r && r.data && ymOf(r.data) === mes && num(r.valor) > 0).map((r) => r.data))],
    [receitas, mes],
  );
  const m = useMemo(
    () => calcularMeta({ metas, realizado, ym: mes, hoje, temReceitaHoje, diasComReceita }),
    [metas, realizado, mes, hoje, temReceitaHoje, diasComReceita],
  );
  const diasAbre = (Array.isArray(metas?.diasSemana) && metas.diasSemana.length && metas.diasSemana.length < 7)
    ? metas.diasSemana : null;
  const est = ESTADOS[m.estado] || ESTADOS.comecando;

  const abrir = () => {
    setValor(m.meta > 0 ? String(m.meta).replace('.', ',') : '');
    setSoEsteMes(metas && metas[mes] !== undefined && String(metas[mes]).trim() !== '');
    setDias(Array.isArray(metas?.diasSemana) && metas.diasSemana.length ? [...metas.diasSemana] : [0, 1, 2, 3, 4, 5, 6]);
    // No canto o editor mora DENTRO do painel que abre por cima — senão ele
    // tentaria caber no quadradinho de 104px do cabeçalho.
    setAberto(true);
    setEditando(true);
  };
  const salvar = () => {
    const v = num(valor);
    const novo = { ...(metas || {}) };
    if (soEsteMes) novo[mes] = v > 0 ? String(v) : '';
    else { novo.padrao = v > 0 ? String(v) : ''; delete novo[mes]; }
    novo.diasSemana = (dias && dias.length && dias.length < 7) ? [...dias].sort((a, b) => a - b) : null;
    onSalvar(novo);
    setEditando(false);
  };
  const usarMovimento = () => {
    const d = diasSemanaDoMovimento(receitas, hoje);
    if (d && d.length) setDias(d);
  };
  const alternar = (d) => setDias((atual) => {
    const s = new Set(atual || []);
    if (s.has(d)) s.delete(d); else s.add(d);
    return [...s];
  });

  const montarEditor = () => {
    const sug = diasSemanaDoMovimento(receitas, hoje);
    const noMes = diasDeOperacao(mes, (dias && dias.length && dias.length < 7) ? dias : null, diasComReceita);
    return (
      <Card style={{ marginBottom: 14, borderColor: C.accent }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>Minha meta</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
          Quanto tu queres faturar num mês. O PicoOS reparte isso pelos dias em que o bar abre e
          te diz, todo dia, quanto falta.
        </div>
        <Field label="Meta de faturamento no mês (R$)">
          <NumInput value={valor} onChange={setValor} placeholder="ex: 40000" />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '-4px 0 14px', fontSize: 13, color: C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={soEsteMes} onChange={(e) => setSoEsteMes(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.accent }} />
          Vale só para {mesLabel(mes)} (senão vale todo mês)
        </label>

        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 7, lineHeight: 1.45 }}>
          Em que dias o bar abre? É por aí que a meta é repartida — contar os dias fechados daria
          um alvo diário que não existe.
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {DIAS.map(([rot, d]) => {
            const on = (dias || []).includes(d);
            return (
              <button key={d} onClick={() => alternar(d)} title={NOMES[d]} aria-label={NOMES[d]} aria-pressed={on}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                  background: on ? C.accent : 'transparent', color: on ? '#06101F' : C.muted,
                  border: `1px solid ${on ? C.accent : C.line}`,
                }}>{rot}</button>
            );
          })}
        </div>
        {/* O NÚMERO QUE A MARCAÇÃO PRODUZ, NA HORA.
            Sem isto ela marcou um dia só sem perceber, o mês virou "4 noites"
            e a tela passou a pedir R$ 6.161 por noite. Agora o resultado
            aparece enquanto ela toca, e um número absurdo salta à vista. */}
        <div style={{
          fontSize: 13, lineHeight: 1.5, marginBottom: 10, padding: '8px 11px', borderRadius: 9,
          background: C.panel2, border: `1px solid ${noMes.length < 8 ? C.amber : C.line}`,
          color: noMes.length < 8 ? C.amber : C.muted,
        }}>
          {(dias || []).length === 0 ? (
            <>Nenhum dia marcado — marca pelo menos os dias em que tu abres.</>
          ) : (
            <>
              Abrindo <b style={{ color: C.text }}>{(dias || []).length === 7 ? 'todo dia' : listar([...(dias || [])].sort((a, b) => a - b))}</b>,
              {' '}{mesLabel(mes)} tem <b style={{ color: C.text }}>{noMes.length} noite{noMes.length === 1 ? '' : 's'}</b>
              {num(valor) > 0 && noMes.length > 0 && <> — dá <b style={{ color: C.text }}>{brl(num(valor) / noMes.length)}</b> por noite</>}.
              {noMes.length < 8 && <><br />Isso parece pouco. Confere se não ficou dia de menos marcado.</>}
            </>
          )}
        </div>
        {sug && sug.length > 0 && sug.length < 7 && (
          <button onClick={usarMovimento} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '2px 0', marginBottom: 12, textAlign: 'left' }}>
            Pelos últimos 90 dias tu abres {sug.map((d) => NOMES[d]).join(', ')} — usar isso
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Btn onClick={salvar}>Salvar meta</Btn>
          <Btn kind="ghost" onClick={() => setEditando(false)}>Cancelar</Btn>
        </div>
      </Card>
    );
  };

  // O PAINEL QUE ABRE POR CIMA, no modo canto. Escrito uma vez: ele serve pro
  // detalhe da meta e pro editor, e os dois precisam dele antes mesmo de
  // existir meta nenhuma — senão tocar em "definir a meta" abriria um editor
  // sem lugar onde aparecer.
  const painelPorCima = (conteudo, borda) => (
    <div onClick={() => { setAberto(false); setEditando(false); }}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(4, 9, 18, 0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Meta do mês"
        style={{ width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto', background: C.panel, border: `1px solid ${borda || C.line}`, borderRadius: 16, padding: 18, boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
        {conteudo}
      </div>
    </div>
  );

  // No cartão largo o editor toma o lugar do cartão, como sempre tomou. No
  // canto ele vai pro painel.
  if (editando && !canto) return montarEditor();
  if (editando && canto) return painelPorCima(montarEditor(), C.accent);

  // SEM META: convida, e não inventa número nenhum.
  if (m.semMeta) {
    if (canto) {
      return (
        <button onClick={abrir} title="Definir a meta do mês"
          style={{
            flex: '1 1 104px', minWidth: 104, minHeight: 104, borderRadius: 18, cursor: 'pointer',
            background: 'transparent', border: `1px dashed ${C.line}`, color: C.muted,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8,
            alignSelf: 'stretch', marginBottom: 14,
          }}>
          <span style={{ fontSize: 22, fontWeight: 300, lineHeight: 1 }}>+</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3, textAlign: 'center' }}>Definir<br />a meta</span>
        </button>
      );
    }
    return (
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Define tua meta do mês</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>
              Aí o Dashboard te diz todo dia quanto falta e quanto precisa por noite pra chegar lá.
            </div>
          </div>
          <Btn small onClick={abrir}>Definir meta</Btn>
        </div>
      </Card>
    );
  }

  const pctBarra = Math.max(0, Math.min(1, m.pct));
  const pctLinha = m.diasTotais > 0 ? Math.max(0, Math.min(1, m.diasDecorridos / m.diasTotais)) : 0;

  // O DETALHE. É o mesmo conteúdo nos dois formatos — no cartão ele abre
  // embaixo, no canto ele abre por cima. Escrito uma vez só de propósito:
  // duas cópias viram duas verdades diferentes no dia em que uma for mexida.
  const detalhe = (
    <>
      {/* A barra reta mostra o mesmo que o anel, mas é mais fácil de comparar
          com o risco quando se quer conferir — não só olhar de relance. */}
      <div style={{ position: 'relative', height: 10, borderRadius: 999, background: C.panel2, border: `1px solid ${C.hair}`, marginBottom: 4, overflow: 'hidden' }}>
        <i style={{ display: 'block', height: '100%', width: `${pctBarra * 100}%`, background: est.cor, borderRadius: 999, transition: 'width .6s ease-out' }} />
        {pctLinha > 0 && pctLinha < 1 && (
          <i style={{ position: 'absolute', top: -2, bottom: -2, left: `${pctLinha * 100}%`, width: 2, background: C.text, opacity: 0.55 }} title="onde o mês já está" />
        )}
      </div>
      <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 12, lineHeight: 1.45 }}>
        {m.diasDecorridos} de {m.diasTotais} noite{m.diasTotais === 1 ? '' : 's'}
        {diasAbre ? <> · abre {listar([...diasAbre].sort((a, b) => a - b))}</> : ' · abre todo dia'}
        {' '}· o risco é onde o mês já está
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '.05em' }}>Falta</div>
          <div style={{ fontSize: 16, fontWeight: 800, ...TAB }}>{oculto(brl(m.falta))}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '.05em' }}>Por noite</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: m.porDia > 0 ? est.cor : C.faint, ...TAB }}>
            {m.diasRestantes > 0 ? oculto(brl(m.porDia)) : '—'}
          </div>
          <div style={{ fontSize: 11, color: C.faint }}>{m.diasRestantes > 0 ? `nas ${m.diasRestantes} que faltam` : 'mês encerrado'}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '.05em' }}>Fecha em</div>
          <div style={{ fontSize: 16, fontWeight: 800, ...TAB }}>{m.projecao > 0 ? oculto(brl(m.projecao)) : '—'}</div>
          <div style={{ fontSize: 11, color: C.faint }}>{m.projecao > 0 ? `${Math.round(m.pctProjecao * 100)}% da meta` : 'sem ritmo ainda'}</div>
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
        {m.bateu ? (
          <>Bateste a meta de {mesLabel(mes)} — <b style={{ color: C.green }}>{oculto(brl(m.sobrou))}</b> acima. O que vier agora é a mais.</>
        ) : m.diasRestantes <= 0 ? (
          <>{mesLabel(mes)} fechou <b style={{ color: C.red }}>{oculto(brl(m.falta))}</b> abaixo da meta.</>
        ) : m.diasDecorridos === 0 ? (
          <>Mês novo: <b>{oculto(brl(m.porDia))}</b> por noite nas {m.diasRestantes} noites de {mesLabel(mes)} e tu chegas lá.</>
        ) : (
          <>
            Tua média é <b>{oculto(brl(m.media))}</b> por noite; pra bater a meta precisa de{' '}
            <b style={{ color: est.cor }}>{oculto(brl(m.porDia))}</b> nas {m.diasRestantes} que faltam.
            {m.porDia > m.media * 1.3 && <> É bem acima do teu ritmo — ou tu aumentas o movimento, ou essa meta não é desse mês.</>}
          </>
        )}
      </div>

      <button onClick={abrir} style={{ background: 'none', border: 'none', color: C.accent, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '10px 2px 0' }}>
        Editar a meta
      </button>
    </>
  );

  const avisoPoucasNoites = m.poucasNoites && (
    <button onClick={abrir} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: `1px solid ${C.amber}`, borderRadius: 9, padding: '8px 11px', marginBottom: 12, color: C.amber, fontSize: 12.5, lineHeight: 1.45 }}>
      <b>Só {m.diasTotais} noite{m.diasTotais === 1 ? '' : 's'} em {mesLabel(mes)}?</b> Parece que faltou marcar
      dia em “em que dias o bar abre” — e é por aí que o valor por noite é calculado. Toca pra conferir.
    </button>
  );

  // ---------------------------------------------------------------- NO CANTO
  if (canto) {
    return (
      <>
        <button
          onClick={() => setAberto(true)}
          title={`Meta de ${mesLabel(mes)}`}
          style={{
            flex: '1 1 104px', minWidth: 104, borderRadius: 18, cursor: 'pointer', padding: '10px 8px',
            background: C.panel, border: `1px solid ${m.poucasNoites ? C.amber : `${est.cor}66`}`,
            color: C.text, display: 'flex', flexDirection: 'column', alignItems: 'center',
            // Acompanha a altura do cartão ao lado: dois blocos do mesmo
            // tamanho leem como um só; um alto e um baixo leem como sobra.
            justifyContent: 'center', gap: 6, alignSelf: 'stretch', marginBottom: 14,
          }}>
          <Relogio pct={m.pct} pace={pctLinha} cor={m.poucasNoites ? C.amber : est.cor} tamanho={62} />
          {/* QUANDO A MARCAÇÃO DOS DIAS ESTÁ ERRADA, É ISSO QUE PRECISA SER
              LIDO — não o valor. Foi assim que um mês virou "4 noites" e a tela
              passou a pedir R$ 6.161 por noite sem ninguém perceber. */}
          {m.poucasNoites ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: C.amber, lineHeight: 1.25, textAlign: 'center' }}>
              só {m.diasTotais} noite{m.diasTotais === 1 ? '' : 's'}?
            </span>
          ) : (
            <span style={{ fontSize: 11.5, fontWeight: 800, lineHeight: 1.2, ...TAB }}>{oculto(brl(m.realizado))}</span>
          )}
          <span style={{ fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
            Meta
          </span>
        </button>

        {aberto && painelPorCima(
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700 }}>Meta · {mesLabel(mes)}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: est.cor, lineHeight: 1.2, marginTop: 2, ...TAB }}>{oculto(brl(m.realizado))}</div>
                <div style={{ fontSize: 13, color: C.muted, ...TAB }}>de {oculto(brl(m.meta))} · {est.titulo}</div>
              </div>
              <button onClick={() => setAberto(false)} aria-label="Fechar"
                style={{ background: 'none', border: 'none', color: C.muted, fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
            </div>
            {avisoPoucasNoites}
            {detalhe}
          </>,
          `${est.cor}66`,
        )}
      </>
    );
  }

  // ------------------------------------------------------------- NO CARTÃO
  return (
    <Card style={{ marginBottom: 14, borderColor: `${est.cor}66`, padding: 14 }}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.text }}
      >
        <Relogio pct={m.pct} pace={pctLinha} cor={est.cor} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700 }}>
            Meta · {mesLabel(mes)}
          </span>
          <span style={{ display: 'block', fontSize: 19, fontWeight: 900, color: est.cor, lineHeight: 1.2, marginTop: 2, ...TAB }}>
            {oculto(brl(m.realizado))}
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: C.muted, ...TAB }}>de {oculto(brl(m.meta))} · {est.titulo}</span>
          {m.diasRestantes > 0 && !m.bateu && (
            <span style={{ display: 'block', fontSize: 12.5, marginTop: 3, color: C.faint }}>
              <b style={{ color: est.cor, ...TAB }}>{oculto(brl(m.porDia))}</b> por noite nas {m.diasRestantes} que faltam
            </span>
          )}
        </span>
        <span style={{ flexShrink: 0, color: C.faint, fontSize: 13, transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
      </button>
      {m.poucasNoites && <div style={{ marginTop: 12 }}>{avisoPoucasNoites}</div>}
      {aberto && <div style={{ marginTop: 14, borderTop: `1px solid ${C.hair}`, paddingTop: 12 }}>{detalhe}</div>}
    </Card>
  );
}
