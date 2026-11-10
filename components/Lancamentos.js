'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, KPI, Field, TextInput, NumInput, Select, Area, Empty, Resumo, SecTitle, PageTitle, inputStyle } from './ui';
import { brl, num, todayISO, ymOf, weekday, fmtDate, mesLabel, addDays, uid, limparNome, FONTES_RECEITA, CUSTO_VARIAVEL, DESPESA_OPERACIONAL, CATEGORIAS_DESPESA, CATEGORIAS_PRODUTO, DIAS, MESES } from '../lib/util';
import { resumoBusca, sugestoes } from '../lib/buscaLancamento';

// Os períodos prontos. 90 dias está aqui porque foi o pedido literal — é a
// janela em que ela pensa quando quer saber se um gasto está crescendo.
const PERIODOS = [
  ['30', '30 dias', 30], ['90', '90 dias', 90], ['180', '6 meses', 180],
  ['365', '12 meses', 365], ['tudo', 'Tudo', 0], ['datas', 'Escolher datas', 0],
];

const pill = (on) => ({
  border: `1px solid ${on ? C.accent : C.line}`,
  background: on ? C.accent : 'transparent',
  color: on ? '#06101F' : C.muted,
  borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
});

export default function Lancamentos({ tipo, dados, onChange }) {
  const isReceita = tipo === 'receita';
  const catOptions = isReceita ? FONTES_RECEITA : CATEGORIAS_DESPESA;
  const catLabel = isReceita ? 'Fonte de receita' : 'Categoria da despesa';
  const cor = isReceita ? C.green : C.red;
  const vazio = { data: todayISO(), categoria: '', descricao: '', valor: '', obs: '' };
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const [filtroMes, setFiltroMes] = useState(ymOf(todayISO()));
  const [visao, setVisao] = useState('lancar');   // 'lancar' | 'procurar'
  const [termo, setTermo] = useState('');
  const [periodo, setPeriodo] = useState('90');
  const [deManual, setDeManual] = useState('');
  const [ateManual, setAteManual] = useState('');
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const salvar = () => {
    if (!form.data || !form.categoria) return;
    if (editId) onChange(dados.map((d) => d.id === editId ? { ...form, id: editId } : d));
    else onChange([{ ...form, id: uid() }, ...dados]);
    setForm(vazio); setEditId(null);
  };
  // Alerta de possível duplicata: mesmo dia + mesmo valor + mesmo fornecedor
  // (descrição). Não bloqueia — só avisa, pra evitar lançar a mesma conta duas
  // vezes sem querer. Ignora o próprio item quando está editando.
  const chaveDup = (d) => `${d.data}|${num(d.valor).toFixed(2)}|${limparNome(d.descricao).toLowerCase()}`;
  const duplicata = useMemo(() => {
    if (!form.data || num(form.valor) <= 0 || !limparNome(form.descricao)) return null;
    const chave = chaveDup(form);
    return dados.find((d) => d.id !== editId && chaveDup(d) === chave) || null;
  }, [form, dados, editId]);

  const editar = (d) => { setForm(d); setEditId(d.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const excluir = (id) => onChange(dados.filter((d) => d.id !== id));
  const mesesDisponiveis = [...new Set(dados.map((d) => ymOf(d.data)))].sort().reverse();
  const filtrados = dados.filter((d) => ymOf(d.data) === filtroMes).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const total = filtrados.reduce((s, d) => s + num(d.valor), 0);
  const totalGeral = dados.reduce((s, d) => s + num(d.valor), 0);

  // ---- a busca ----
  const hojeISO = todayISO();
  const janela = useMemo(() => {
    if (periodo === 'tudo') return { de: '', ate: hojeISO };
    if (periodo === 'datas') return { de: deManual || '', ate: ateManual || hojeISO };
    const n = Number(periodo) || 90;
    // Hoje conta como o primeiro dos N: 90 dias é hoje mais os 89 de trás.
    return { de: addDays(hojeISO, -(n - 1)), ate: hojeISO };
  }, [periodo, deManual, ateManual, hojeISO]);
  const busca = useMemo(() => resumoBusca(dados, { termo, de: janela.de, ate: janela.ate }), [dados, termo, janela]);
  const atalhos = useMemo(() => sugestoes(dados, { de: janela.de, ate: janela.ate }), [dados, janela]);
  const maiorMes = busca.porMes.reduce((m, x) => Math.max(m, x.total), 0);

  const cartao = (d) => (
    <Card key={d.id} style={{ marginBottom: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{d.categoria}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{fmtDate(d.data)}{d.descricao ? ' · ' + d.descricao : ''}</div>
          {d.obs && <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{d.obs}</div>}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{brl(num(d.valor))}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" small onClick={() => editar(d)}>Editar</Btn>
            <Btn kind="danger" small onClick={() => excluir(d.id)}>×</Btn>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div>
      <PageTitle sub={isReceita ? 'Tudo que entra no caixa' : 'Tudo que sai, por categoria'}>{isReceita ? 'Receitas' : 'Despesas'}</PageTitle>
      <Resumo items={[
        { t: isReceita ? 'Receitas lançadas' : 'Despesas lançadas', v: dados.length },
        { t: 'Total acumulado', v: brl(totalGeral), c: cor },
      ]} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['lancar', 'Lançar'], ['procurar', 'Procurar']].map(([v, rot]) => (
          <button key={v} onClick={() => setVisao(v)} style={pill(visao === v)}>{rot}</button>
        ))}
      </div>

      {visao === 'lancar' && (<>
      <Card style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>{editId ? 'Editar' : 'Novo'} lançamento — {isReceita ? 'Receita' : 'Despesa'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Data"><TextInput type="date" value={form.data} onChange={set('data')} /></Field>
          <Field label="Valor (R$)"><NumInput value={form.valor} onChange={set('valor')} /></Field>
        </div>
        <Field label={catLabel}><Select value={form.categoria} onChange={set('categoria')} options={catOptions} /></Field>
        <Field label="Descrição"><TextInput value={form.descricao} onChange={set('descricao')} placeholder={isReceita ? 'Sexta-feira, Sábado…' : 'Fornecedor / item…'} /></Field>
        <Field label="Observação"><TextInput value={form.obs} onChange={set('obs')} placeholder="Opcional" /></Field>

        {duplicata && !editId && (
          <div style={{ background: C.raised, border: `1px solid ${C.amber}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.amber, fontWeight: 800, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Possível duplicata</div>
            <div style={{ fontSize: 13, color: C.text }}>Já existe um lançamento com a mesma data, valor e {isReceita ? 'descrição' : 'fornecedor'}:</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              {fmtDate(duplicata.data)} · {duplicata.categoria}{duplicata.descricao ? ' · ' + limparNome(duplicata.descricao) : ''} · <b style={{ color: cor }}>{brl(num(duplicata.valor))}</b>
            </div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>Se for outra compra igual, pode lançar mesmo assim.</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={salvar}>{editId ? 'Salvar' : (duplicata ? 'Lançar mesmo assim' : 'Lançar')}</Btn>
          {editId && <Btn kind="ghost" onClick={() => { setForm(vazio); setEditId(null); }}>Cancelar</Btn>}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Select value={filtroMes} onChange={setFiltroMes} options={mesesDisponiveis.length ? mesesDisponiveis : [ymOf(todayISO())]} placeholder="Mês" />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total do mês</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</div>
        </div>
      </div>

      {filtrados.length === 0 ? <Empty>Nenhum lançamento neste mês.</Empty> : filtrados.map(cartao)}
      </>)}

      {visao === 'procurar' && (<>
        <div style={{ marginBottom: 10 }}>
          <TextInput value={termo} onChange={setTermo} placeholder={isReceita ? 'Procurar: promoção, sábado…' : 'Procurar: pro labore, claude, energia…'} />
        </div>

        <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
          {PERIODOS.map(([v, rot]) => (
            <button key={v} onClick={() => setPeriodo(v)} style={{ ...pill(periodo === v), padding: '6px 12px', fontSize: 12.5 }}>{rot}</button>
          ))}
        </div>

        {periodo === 'datas' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="De"><TextInput type="date" value={deManual} onChange={setDeManual} /></Field>
            <Field label="Até"><TextInput type="date" value={ateManual} onChange={setAteManual} /></Field>
          </div>
        )}

        {/* CAMPO VAZIO É UMA PAREDE: ela teria que adivinhar o que digitar.
            Então a tela oferece onde mais saiu dinheiro no período. */}
        {!termo.trim() && atalhos.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 6 }}>Toca pra ver, ou digita o que tu quiser:</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {atalhos.map((a) => (
                <button key={a.categoria} onClick={() => setTermo(a.categoria)}
                  style={{ border: `1px solid ${C.line}`, background: 'transparent', color: C.muted, borderRadius: 999, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  {a.categoria} <span style={{ color: cor, fontWeight: 800 }}>{brl(a.total)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {termo.trim() ? `"${termo.trim()}"` : (isReceita ? 'Tudo que entrou' : 'Tudo que saiu')}
            {busca.de ? ` · ${fmtDate(busca.de)} a ${fmtDate(busca.ate)}` : ''}
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: cor, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, marginTop: 2 }}>{brl(busca.total)}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            {busca.n} lançamento{busca.n === 1 ? '' : 's'}
            {busca.mesesNaJanela > 1 && <> · dá <b style={{ color: C.text }}>{brl(busca.mediaMes)}</b> por mês</>}
          </div>

          {/* O NÚMERO SOZINHO NÃO DIZ NADA. "R$ 4.500 em 90 dias" só vira
              informação do lado dos 90 dias anteriores. */}
          {busca.anterior && (busca.anterior.total > 0 || busca.total > 0) && (
            <div style={{ fontSize: 12.5, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}`, lineHeight: 1.5, color: C.muted }}>
              Nos {busca.dias} dias antes disso: <b style={{ color: C.text }}>{brl(busca.anterior.total)}</b>
              {busca.variacaoPct != null && (
                <b style={{ color: busca.variacaoPct > 0 ? (isReceita ? C.green : C.red) : busca.variacaoPct < 0 ? (isReceita ? C.red : C.green) : C.muted }}>
                  {' · '}{busca.variacaoPct > 0 ? 'subiu' : busca.variacaoPct < 0 ? 'caiu' : 'igual'}
                  {busca.variacaoPct !== 0 ? ` ${Math.abs(busca.variacaoPct)}%` : ''}
                </b>
              )}
            </div>
          )}
        </Card>

        {busca.porMes.length > 1 && (
          <Card style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: C.accent, marginBottom: 8 }}>Mês a mês</div>
            {busca.porMes.map((m) => (
              <div key={m.ym} style={{ marginTop: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{m.rot}</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{brl(m.total)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: C.line, marginTop: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${maiorMes > 0 ? (m.total / maiorMes) * 100 : 0}%`, background: cor, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </Card>
        )}

        {busca.porCategoria.length > 1 && (
          <Card style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: C.accent, marginBottom: 2 }}>Em quais categorias</div>
            <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.45, marginBottom: 6 }}>
              Mesma coisa lançada em categorias diferentes aparece aqui separada — é o jeito de descobrir isso.
            </div>
            {busca.porCategoria.map((c) => (
              <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, borderTop: `1px solid ${C.hair}`, paddingTop: 6, marginTop: 6 }}>
                <span style={{ color: C.muted, minWidth: 0 }}>{c.categoria} <span style={{ color: C.faint }}>· {c.n}×</span></span>
                <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(c.total)}</span>
              </div>
            ))}
          </Card>
        )}

        {busca.n === 0
          ? <Empty>{termo.trim() ? `Nada com "${termo.trim()}" nesse período.` : 'Nenhum lançamento nesse período.'}<br />Tenta uma palavra mais curta, ou abre o período.</Empty>
          : busca.itens.map(cartao)}
      </>)}
    </div>
  );
}

