'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { C, Card, Btn, Empty, QtdInput } from './ui';
import { brl, limparNome } from '../lib/util';
import { Garrafa, Passo, passo, veredito, SINAL, resumoContado } from './ControleDoses';
import Acessos from './Acessos';
import CalendarioTarefas from './CalendarioTarefas';
import AvisoReservas from './AvisoReservas';
import AvisoPorcoes from './AvisoPorcoes';

// AS TELAS DA GERENTE — o que ela vê e o resto da equipe não.
//
// Tudo aqui vem de /api/gerencia (e o ponto da equipe, de /api/ponto), que só
// devolvem o que a dona liberou: meta em porcentagem, quem deve no fiado, a
// lista de garrafas pra contar. Nenhum número de faturamento, custo ou
// salário passa por esta tela — nem escondido, nem "só no código".

const hora = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const SETOR = { garcom: 'Atendimento', cozinha: 'Cozinha', extra: 'Extra', dona: 'Dona', reservas: 'Reservas' };
const plural = (n, um, varios) => (Math.abs(Number(n)) === 1 ? um : varios);

const RECADO_META = {
  bateu: 'Meta batida!',
  adiantada: 'Adiantados: acima do ritmo.',
  'no-ritmo': 'No ritmo certo.',
  atras: 'Um pouco atrás do ritmo.',
  'muito-atras': 'Bem atrás do ritmo.',
  comecando: 'O mês está começando.',
  'fechou-abaixo': 'O mês fechou abaixo da meta.',
};

function Meta({ meta }) {
  if (!meta) return null;
  if (meta.semMeta) {
    return (
      <Card data-gerencia="meta" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Meta do mês</div>
        <div style={{ fontSize: 13.5, color: C.faint, marginTop: 6 }}>A meta deste mês ainda não foi definida.</div>
      </Card>
    );
  }
  const cor = meta.bateu || meta.estado === 'adiantada' || meta.estado === 'no-ritmo' ? C.green : meta.estado === 'muito-atras' || meta.estado === 'fechou-abaixo' ? C.red : C.amber;
  return (
    <Card data-gerencia="meta" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Meta do mês</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
        <div style={{ fontSize: 40, fontWeight: 900, color: cor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05 }}>{meta.pct}%</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: cor }}>{RECADO_META[meta.estado] || ''}</div>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: C.line, overflow: 'hidden', marginTop: 8 }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, meta.pct))}%`, background: cor, borderRadius: 4 }} />
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
        {meta.bateu
          ? 'Parabéns pra equipe.'
          : <>{meta.diasRestantes} {plural(meta.diasRestantes, 'dia de bar', 'dias de bar')} pela frente · nesse ritmo o mês fecha em <b style={{ color: C.text }}>{meta.pctProjecao}%</b></>}
      </div>
    </Card>
  );
}

function Equipe({ equipe }) {
  if (!equipe) return null;
  const agora = equipe.filter((r) => !r.saida);
  const sairam = equipe.filter((r) => r.saida);
  return (
    <Card data-gerencia="equipe" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>Equipe hoje</div>
      {equipe.length === 0 ? (
        <div style={{ fontSize: 13, color: C.faint }}>Ninguém bateu o ponto hoje ainda.</div>
      ) : (
        <>
          {agora.map((r, i) => (
            <div key={`a${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, padding: '5px 0', borderTop: `1px solid ${C.hair}` }}>
              <span><span style={{ color: C.green, fontWeight: 900 }}>● </span><b>{r.nome}</b> <span style={{ color: C.faint }}>· {SETOR[r.setor] || r.setor || '—'}</span></span>
              <span style={{ color: C.muted, flexShrink: 0 }}>desde {hora(r.entrada)}</span>
            </div>
          ))}
          {sairam.map((r, i) => (
            <div key={`s${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '5px 0', borderTop: `1px solid ${C.hair}`, color: C.faint }}>
              <span>{r.nome} · {SETOR[r.setor] || r.setor || '—'}</span>
              <span style={{ flexShrink: 0 }}>{hora(r.entrada)}–{hora(r.saida)}</span>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

function Fiados({ fiados }) {
  const [copiado, setCopiado] = useState('');
  if (!fiados) return null;
  const copiar = async (f) => {
    try { await navigator.clipboard.writeText(f.mensagem); setCopiado(`Mensagem pra ${f.nome} copiada. Abre o WhatsApp e cola.`); }
    catch { setCopiado(`Não consegui copiar. A mensagem é: ${f.mensagem}`); }
  };
  return (
    <Card data-gerencia="fiados" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Fiado pra cobrar</div>
      <div style={{ fontSize: 12, color: C.faint, marginBottom: 8, lineHeight: 1.45 }}>Quem deve e quanto. O botão abre o WhatsApp com a mensagem pronta. Receber o pagamento continua com a dona.</div>
      {copiado && <div style={{ fontSize: 12.5, color: C.green, fontWeight: 700, marginBottom: 8 }}>{copiado}</div>}
      {fiados.length === 0 ? <div style={{ fontSize: 13, color: C.faint }}>Ninguém devendo. 👏</div> : fiados.map((f) => (
        <div key={f.nome} data-fiado-nome={f.nome} style={{ borderTop: `1px solid ${C.hair}`, padding: '9px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <b style={{ fontSize: 14.5, minWidth: 0 }}>{f.nome}</b>
            <b style={{ fontSize: 15, color: f.cobrarAgora ? C.red : C.amber, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(f.total)}</b>
          </div>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 1 }}>
            {f.cobrarAgora ? <>cobrar agora: <b style={{ color: C.muted }}>{brl(f.agora)}</b>{f.proximo > 0.005 ? <> · o resto fica pro mês que vem</> : null}</> : 'só consumiu depois que o mês virou: cobra no mês que vem'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
            {f.link
              ? <Btn small href={f.link} target="_blank" rel="noopener noreferrer">Cobrar no WhatsApp</Btn>
              : <Btn small kind="ghost" onClick={() => copiar(f)}>Copiar a cobrança</Btn>}
            {!f.temTelefone && <span style={{ fontSize: 11.5, color: C.faint, alignSelf: 'center' }}>sem telefone no cadastro</span>}
          </div>
        </div>
      ))}
    </Card>
  );
}

// CONTAR GARRAFAS. A mesma conta da tela da dona, feita no servidor; aqui só
// se marca o que tem na prateleira. O resultado volta em doses.
function Doses({ doses, onFeito }) {
  const [modo, setModo] = useState('acabou');
  const [alvo, setAlvo] = useState(null);
  const [fechadas, setFechadas] = useState('');
  const [tamanho, setTamanho] = useState('');
  const [semana, setSemana] = useState({});
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [resultados, setResultados] = useState([]);
  if (!doses) return null;

  const mandar = async (tipo, itens) => {
    setBusy(true); setErro('');
    try {
      const r = await fetch('/api/gerencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'doses', tipo, itens }) });
      const j = await r.json();
      if (!j.ok) { setErro(j.erro || 'Não consegui conferir.'); return false; }
      setResultados(j.resultados || []);
      onFeito && onFeito();
      return true;
    } catch { setErro('Sem conexão.'); return false; }
    finally { setBusy(false); }
  };

  const frase = (r) => {
    const d = r.doses == null ? '' : `${String(r.doses).replace('.', ',')} ${plural(r.doses, 'dose', 'doses')}${r.doseNome ? ` de ${r.doseNome}` : ''}`;
    if (r.estado === 'partida') return 'Primeira vez que essa garrafa é contada: o estoque foi acertado. Da próxima vez eu comparo.';
    if (r.estado === 'bateu') return 'O que saiu da garrafa passou pela comanda.';
    if (r.estado === 'sobrou') return `Tem ${d} a mais do que eu esperava. Avisa a dona: pode ser compra não lançada.`;
    if (r.estado === 'pouco') return `Faltaram ${d}. Dentro do que mão pesada explica.`;
    return `Faltaram ${d}. É mais do que mão pesada explica — conta pra dona.`;
  };
  const COR = { partida: C.accent, bateu: C.green, pouco: C.amber, sumiu: C.red, sobrou: '#6AA9FF' };
  const prontos = doses.semana.filter((it) => it.embalagem && semana[it.id] && semana[it.id].cheias !== undefined && semana[it.id].nivel != null);
  const pill = (on) => ({ border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : 'transparent', color: on ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 800, cursor: 'pointer' });

  return (
    <Card data-gerencia="doses" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Controle de doses</div>
      <div style={{ fontSize: 12, color: C.faint, marginBottom: 10, lineHeight: 1.45 }}>Tu conta; o app compara com o que passou pela comanda. Quanto isso vale em reais, a dona vê na tela dela.</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => { setModo('acabou'); setErro(''); }} style={pill(modo === 'acabou')}>Acabou a garrafa</button>
        <button onClick={() => { setModo('semana'); setErro(''); }} style={pill(modo === 'semana')}>Conferência da semana</button>
      </div>
      {erro && <div style={{ fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 8 }}>{erro}</div>}
      {resultados.length > 0 && (
        <div data-resultado-doses style={{ marginBottom: 10 }}>
          {resultados.map((r, i) => (
            <div key={i} style={{ borderLeft: `4px solid ${COR[r.estado] || C.line}`, padding: '7px 11px', marginBottom: 6, background: C.panel2, borderRadius: 8 }}>
              <b style={{ fontSize: 13.5 }}>{limparNome(r.nome)}</b>
              <div data-veredito={r.estado} style={{ fontSize: 13.5, fontWeight: 900, color: COR[r.estado] || C.text }}>{SINAL[r.estado] || ''} {veredito(r)}</div>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.45 }}>{frase(r)}</div>
            </div>
          ))}
        </div>
      )}

      {modo === 'acabou' && (!alvo ? (
        (doses.todas.length === 0) ? <Empty>Nenhuma bebida com ficha técnica pra contar ainda.</Empty> : doses.todas.map((it) => (
          <button key={it.id} data-acabou={it.id} onClick={() => { setAlvo(it); setFechadas(''); setTamanho(''); setResultados([]); }}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 10, background: 'none', border: 'none', borderTop: `1px solid ${C.line}`, padding: '10px 2px', cursor: 'pointer', color: C.text, textAlign: 'left' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{limparNome(it.nome)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: C.accent, flexShrink: 0 }}>Acabou ›</span>
          </button>
        ))
      ) : (
        <div data-painel="acabou">
          <div style={{ fontSize: 15.5, fontWeight: 900, marginBottom: 8 }}>{limparNome(alvo.nome)}</div>
          {alvo.medido && !alvo.embalagem && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, color: C.amber, marginBottom: 6 }}>Guardado em {alvo.unidade}: quanto vem em cada embalagem?</div>
              <div style={{ maxWidth: 180 }}><QtdInput value={tamanho} onChange={setTamanho} placeholder={`${alvo.unidade} por embalagem`} /></div>
            </div>
          )}
          <Passo valor={fechadas} onDelta={(d) => setFechadas((v) => passo(v, d))} rotulo="Quantas FECHADAS sobraram na prateleira?" dica="lacradas — a que acabou não conta" />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn disabled={busy} onClick={async () => {
              if (fechadas === '') { setErro('Diz quantas fechadas sobraram — pode ser zero.'); return; }
              const ok = await mandar('acabou', [{ id: alvo.id, cheias: Number(fechadas), tamanho }]);
              if (ok) setAlvo(null);
            }}>{busy ? 'Conferindo…' : 'Conferir'}</Btn>
            <Btn kind="ghost" onClick={() => setAlvo(null)}>Voltar</Btn>
          </div>
        </div>
      ))}

      {modo === 'semana' && (doses.semana.length === 0 ? <Empty>Ainda não dá pra saber quais garrafas giram mais.</Empty> : (
        <>
          {doses.semana.map((it) => {
            const c = semana[it.id] || {};
            return (
              <div key={it.id} data-item={it.id} style={{ borderTop: `1px solid ${C.line}`, padding: '11px 0' }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{limparNome(it.nome)}</div>
                {!it.embalagem ? (
                  <div style={{ fontSize: 12.5, color: C.amber, marginTop: 4 }}>Marca um "Acabou" dela uma vez, que lá eu pergunto o tamanho da embalagem.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
                      <Passo valor={c.cheias} onDelta={(d) => setSemana((m) => ({ ...m, [it.id]: { ...(m[it.id] || {}), cheias: passo((m[it.id] || {}).cheias, d) } }))} rotulo="Garrafas FECHADAS" dica="lacradas, sem a aberta" />
                      <Garrafa nivel={c.nivel == null ? null : c.nivel} onNivel={(n) => setSemana((m) => ({ ...m, [it.id]: { ...(m[it.id] || {}), nivel: n } }))} />
                    </div>
                    {resumoContado(c.cheias, c.nivel) && <div data-resumo style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8 }}>= {resumoContado(c.cheias, c.nivel)}</div>}
                  </>
                )}
              </div>
            );
          })}
          <Btn disabled={busy || !prontos.length} onClick={async () => {
            const ok = await mandar('semanal', prontos.map((it) => ({ id: it.id, cheias: Number(semana[it.id].cheias), nivel: semana[it.id].nivel })));
            if (ok) setSemana({});
          }}>{busy ? 'Conferindo…' : prontos.length ? `Conferir ${prontos.length} ${plural(prontos.length, 'garrafa', 'garrafas')}` : 'Conta pelo menos uma'}</Btn>
        </>
      ))}
    </Card>
  );
}

// OS DADOS DA GERENTE, carregados UMA vez pela tela dela e repartidos entre
// as telas do menu (início, fiado, controle, equipe). Assim o número de
// tarefas no menu e a lista no calendário são sempre o mesmo número.
export function useGerencia() {
  const [dados, setDados] = useState(null);
  const [equipe, setEquipe] = useState(null);
  const [erro, setErro] = useState('');
  const carregar = useCallback(async () => {
    try {
      const [g, p] = await Promise.all([
        fetch('/api/gerencia', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/ponto', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (g && g.ok) { setDados(g); setErro(''); } else setErro((g && g.erro) || 'Não consegui carregar.');
      if (p && p.ok && Array.isArray(p.equipeHoje)) setEquipe(p.equipeHoje);
    } catch { setErro('Sem conexão.'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  return { dados, setDados, equipe, erro, carregar };
}

const Carregando = ({ g }) => (
  <>
    {g.erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{g.erro}</div>}
    {!g.dados && !g.erro && <Empty>Carregando…</Empty>}
  </>
);

// CADA PEDAÇO É UMA TELA DO MENU, igual ao painel da dona: um assunto por
// tela, com o nome em cima, em vez de tudo empilhado numa aba só.
export function FiadosGerente({ g }) {
  return <><Carregando g={g} />{g.dados && <Fiados fiados={g.dados.fiados} />}</>;
}
export function DosesGerente({ g }) {
  return <><Carregando g={g} />{g.dados && <Doses doses={g.dados.doses} onFeito={g.carregar} />}</>;
}
export function EquipeGerente({ g }) {
  return <Equipe equipe={g.equipe || []} />;
}
export function ExtraGerente() {
  return <Acessos soExtra />;
}

// ---------------------------------------------------------------------------
// A TELA INICIAL DELA.
//
// "Crie uma tela inicial bonita, e que nela tenha um calendário no qual eu
// possa pôr tarefas e aparece pra ela."
//
// É a primeira coisa que ela vê ao entrar: o cumprimento, como está a meta
// (que é o bônus dela), quem está no turno, as tarefas que a dona passou e
// as reservas do dia. Dali, um toque leva pras comandas, pro caixa ou pro
// ponto — o resto mora no menu do lado, igual ao da dona.
// ---------------------------------------------------------------------------
const DIAS_EXT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function agoraBR() {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())) if (x.type !== 'literal') p[x.type] = x.value;
  const iso = `${p.year}-${p.month}-${p.day}`;
  return { hora: Number(p.hour), dia: Number(p.day), mes: Number(p.month) - 1, semana: new Date(`${iso}T12:00:00Z`).getUTCDay() };
}

export function InicioGerente({ g, onIr }) {
  const { dados, setDados, equipe, erro } = g;
  const [marcando, setMarcando] = useState('');
  const t = agoraBR();
  const ola = t.hora >= 5 && t.hora < 12 ? 'Bom dia' : t.hora >= 12 && t.hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = dados && dados.nome ? dados.nome.split(/\s+/)[0] : '';
  const noTurno = (equipe || []).filter((r) => !r.saida);
  const tarefas = (dados && dados.tarefas) || [];
  const hojeISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const deHoje = tarefas.filter((x) => x.data === hojeISO && !x.feito).length;

  // Marca na hora (a tela não espera o servidor pra mostrar o ✓) e desfaz se
  // o servidor recusar — senão a tarefa pareceria feita sem estar.
  const marcar = async (id, feito) => {
    if (marcando) return;
    setMarcando(id);
    const antes = dados;
    setDados((d) => ({ ...d, tarefas: d.tarefas.map((x) => (x.id === id ? { ...x, feito } : x)) }));
    try {
      const r = await fetch('/api/gerencia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'tarefa', id, feito }) });
      const j = await r.json();
      if (!j.ok) setDados(antes);
    } catch { setDados(antes); }
    finally { setMarcando(''); }
  };

  const atalho = (area, sub, rot, dica) => (
    <button key={`${area}-${sub || ''}`} data-atalho={sub || area} onClick={() => onIr && onIr(area, sub)} style={{
      flex: '1 1 30%', minWidth: 0, textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: '12px 12px',
      border: `1px solid ${C.line}`, background: C.panel, color: C.text,
    }}>
      <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{rot}</div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{dica}</div>
    </button>
  );

  return (
    <div data-inicio-gerente>
      {/* O CUMPRIMENTO. Grande e com o nome dela: é a tela de quem chega. */}
      <div style={{
        borderRadius: 18, padding: '18px 18px 16px', marginBottom: 14,
        background: `linear-gradient(135deg, color-mix(in srgb, ${C.accent} 26%, ${C.panel}), ${C.panel})`,
        border: `1px solid color-mix(in srgb, ${C.accent} 30%, transparent)`,
      }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>{DIAS_EXT[t.semana]}, {t.dia} de {MESES_EXT[t.mes]}</div>
        <div data-ola style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, marginTop: 4 }}>{ola}{nome ? `, ${nome}` : ''}!</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
          {deHoje > 0 ? <>Tu tens <b style={{ color: C.text }}>{deHoje} {deHoje === 1 ? 'tarefa' : 'tarefas'}</b> pra hoje.</> : 'Nenhuma tarefa pra hoje.'}
          {' '}{noTurno.length > 0 ? <>{noTurno.length} {noTurno.length === 1 ? 'pessoa' : 'pessoas'} no turno agora.</> : 'Ninguém no turno ainda.'}
        </div>
      </div>

      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {atalho('salao', 'comandas', 'Comandas', 'mesas e balcão')}
        {atalho('salao', 'caixa', 'Caixa', 'abrir e fechar')}
        {atalho('ponto', '', 'Ponto', 'entrada e saída')}
      </div>

      <AvisoReservas />
      <AvisoPorcoes onIr={() => onIr && onIr('porcoes')} />

      {!dados ? <Empty>Carregando…</Empty> : (
        <>
          <Meta meta={dados.meta} />
          <CalendarioTarefas modo="gerente" titulo="Minhas tarefas" tarefas={tarefas} onMarcar={marcar} />
          <Equipe equipe={equipe} />
        </>
      )}
    </div>
  );
}
