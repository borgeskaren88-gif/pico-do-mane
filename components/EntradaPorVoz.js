'use client';
import React, { useState, useMemo } from 'react';
import { C, Card, Btn, QtdInput, inputStyle } from './ui';
import { brl, limparNome, numQtd } from '../lib/util';
import { entendeEntradaFalada } from '../lib/estoqueFala';
import MicBtn from './MicBtn';

// ABASTECER FALANDO
//
// Ela dita "entrou 5 red bull, 5 coca zero e 2,500 de limão" e o PicoOS monta
// as linhas. Ela confere, corrige o que estiver errado, e só então grava.
//
// POR QUE TEM TELA DE CONFERÊNCIA. O app que ela viu já abastece direto. Aqui
// não, e não é frescura: o saldo do estoque alimenta o CMV, o custo médio, o
// mínimo sugerido, a curva ABC, a validade por lote e a conferência do
// fechamento de caixa. Um "vinte e cinco" ouvido no lugar de "dois e meio" não
// estragaria só a linha do limão — envenenaria o mês inteiro, e ela só
// descobriria dias depois sem saber de onde veio. Dois segundos de conferência
// valem mais do que isso.
//
// O MICROFONE, E POR QUE SÃO DOIS CAMINHOS. No notebook (Chrome) o ditado do
// navegador funciona e o botão aparece. No iPhone e no iPad o Safari não tem
// ditado, e ali o caminho é o microfone do PRÓPRIO TECLADO, que funciona em
// qualquer campo de texto.
//
// O botão sabe em qual dos dois está e diz o que fazer — antes ele
// simplesmente não existia no iPhone, e a tela virava um campo mudo sem
// explicar que o microfone estava a um toque de distância, no teclado.
export default function EntradaPorVoz({ itens = [], onLote, onLevarPraCompras }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [linhas, setLinhas] = useState(null);   // null = ainda não interpretou
  const [sobra, setSobra] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const ordenados = useMemo(
    () => [...itens].sort((a, b) => limparNome(a.nome).localeCompare(limparNome(b.nome), 'pt-BR')),
    [itens],
  );

  const entender = () => {
    const r = entendeEntradaFalada(texto, itens);
    setLinhas(r.linhas);
    setSobra(r.sobra);
    setMsg(r.linhas.length ? '' : 'Não achei nenhuma quantidade na frase. Fala assim: "5 red bull, 2 quilos de limão".');
  };

  const limpar = () => { setTexto(''); setLinhas(null); setSobra(''); setMsg(''); };

  // Trocar o item na mão resolve a linha: foi ela que disse, não se discute.
  const trocarItem = (id, itemId) => setLinhas((ls) => ls.map((l) => {
    if (l.id !== id) return l;
    const item = itens.find((x) => x.id === itemId) || null;
    return { ...l, item, unidade: item ? (item.unidade || 'un') : l.unidade, nivel: item ? 'ok' : 'nao-achei', recado: item ? '' : 'Escolhe o item.' };
  }));

  const trocarQtd = (id, v) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, qtd: v, nivel: l.item ? 'ok' : l.nivel, recado: l.item ? '' : l.recado } : l)));

  const tirar = (id) => setLinhas((ls) => ls.filter((l) => l.id !== id));

  const prontas = (linhas || []).filter((l) => l.item && numQtd(l.qtd) > 0);
  // Quanto de dinheiro ela falou no total. Zero quando nao falou nenhum — e ai
  // o aviso sobre a despesa nem aparece.
  const temDinheiro = (linhas || []).reduce((t, l) => t + (l.dinheiro ? l.dinheiro.total : 0), 0);

  const gravar = async () => {
    if (busy || !prontas.length) return;
    setBusy(true); setMsg('');
    try {
      const j = await onLote(prontas.map((l) => ({
        id: l.item.id,
        qtd: l.qtd,
        // O custo so viaja quando ela DISSE o preco. Mandar zero aqui apagaria
        // o custo que o item ja tem, e o CMV do mes sumiria junto.
        custo: l.dinheiro && l.dinheiro.custoUnit > 0 ? l.dinheiro.custoUnit : undefined,
      })));
      if (j && j.ok) {
        const n = j.lancadas || prontas.length;
        setMsg(`Pronto: ${n} ${n === 1 ? 'item abastecido' : 'itens abastecidos'}.`);
        setTexto(''); setLinhas(null); setSobra('');
      } else setMsg((j && j.erro) || 'Não consegui lançar. Tenta de novo.');
    } catch {
      setMsg('Não consegui lançar. Tenta de novo.');
    }
    setBusy(false);
  };

  // Ela disse um valor sem dizer de qual: o sistema supoe o total e deixa ela
  // virar pro "cada" com um toque. Preco unitario trocado com total multiplica
  // (ou divide) o custo pela quantidade — e isso entra calado no CMV.
  const trocarTipoPreco = (id) => setLinhas((ls) => (ls || []).map((l) => {
    if (l.id !== id || !l.dinheiro) return l;
    const novoTipo = l.dinheiro.tipo === 'total' ? 'unit' : 'total';
    const total = novoTipo === 'total' ? l.dinheiro.falado : Math.round(l.dinheiro.falado * l.qtdFalada * 100) / 100;
    const custoUnit = l.qtd > 0 ? Math.round((total / l.qtd) * 10000) / 10000 : null;
    const dinheiro = { ...l.dinheiro, tipo: novoTipo, total, custoUnit, suposto: false };
    const nivel = l.nivel === 'confira' && l.item && l.qtd != null ? 'ok' : l.nivel;
    const recado = nivel === 'ok' ? '' : l.recado;
    return { ...l, dinheiro, nivel, recado };
  }));

  // Levar pra Compras em vez de abastecer direto.
  //
  // Os dois caminhos sao EXCLUDENTES de proposito: as Compras dao entrada no
  // estoque quando a nota e salva, entao abastecer aqui e salvar la somaria a
  // mesma mercadoria duas vezes. Quem falou preco quase sempre quer a nota; quem
  // nao falou so quer acertar o saldo.
  const paraCompras = () => {
    if (!onLevarPraCompras) return;
    const itensCompra = prontas.filter((l) => l.dinheiro && l.dinheiro.custoUnit > 0).map((l) => ({
      produto: limparNome(l.item.nome),
      categoria: l.item.categoria || '',
      quantidade: String(l.qtd),
      valorUnit: String(l.dinheiro.custoUnit),
      estoqueId: l.item.id,
      conteudo: '',
      conteudoUnid: '',
    }));
    if (!itensCompra.length) return;
    onLevarPraCompras(itensCompra);
    setTexto(''); setLinhas(null); setSobra(''); setMsg('');
  };

  if (!aberto) {
    return (
      <Card style={{ marginBottom: 14, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Abastecer falando</div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Dita o que chegou e confere antes de gravar</div>
          </div>
          <Btn kind="ghost" small onClick={() => setAberto(true)}>Abrir</Btn>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Abastecer falando</div>
        <Btn kind="ghost" small onClick={() => { setAberto(false); limpar(); }}>Fechar</Btn>
      </div>

      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
        Fala o que chegou, confere as linhas e toca em abastecer. Pode dizer o preço junto:
        {' '}<i>&quot;5 red bull a 8 reais&quot;</i> ou <i>&quot;2 caixas por 120 reais&quot;</i>.
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="entrou 5 red bull, 5 coca zero e 2,500 de limão"
        style={{
          width: '100%', boxSizing: 'border-box', background: C.panel2, color: C.text,
          border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 13px',
          fontSize: 15, lineHeight: 1.45, resize: 'vertical', fontFamily: 'inherit',
        }}
      />

      <div style={{ marginTop: 8 }}>
        <MicBtn value={texto} onChange={setTexto} label="Ditar por voz" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <Btn small onClick={entender} disabled={!texto.trim()}>Entender</Btn>
        {(texto || linhas) && <Btn kind="ghost" small onClick={limpar}>Limpar</Btn>}
      </div>

      {msg && (
        <div style={{ fontSize: 13, color: msg.startsWith('Pronto') ? C.green : C.amber, marginTop: 10, lineHeight: 1.45, fontWeight: 600 }}>{msg}</div>
      )}

      {linhas && linhas.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 800, marginBottom: 8 }}>
            Confere antes de gravar
          </div>

          {linhas.map((l) => {
            const cor = l.nivel === 'ok' ? C.line : l.nivel === 'confira' ? C.amber : C.red;
            return (
              <div key={l.id} style={{ border: `1px solid ${cor}`, borderRadius: 12, padding: '10px 12px', marginBottom: 8, background: C.panel2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: l.nivel === 'ok' ? 0 : 8 }}>
                  <div style={{ width: 92, flexShrink: 0 }}>
                    <QtdInput value={l.qtd == null ? '' : String(l.qtd)} onChange={(v) => trocarQtd(l.id, v)} />
                  </div>
                  <span style={{ fontSize: 13, color: C.faint, flexShrink: 0 }}>{l.unidade}</span>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.item ? limparNome(l.item.nome) : <span style={{ color: C.red }}>{l.falado || 'sem nome'}</span>}
                    </div>
                    {l.item && l.falado && (
                      <div style={{ fontSize: 11, color: C.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>tu falou "{l.falado}"</div>
                    )}
                  </div>
                  <button type="button" onClick={() => tirar(l.id)} aria-label="Tirar esta linha"
                    style={{ background: 'transparent', border: 'none', color: C.faint, fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>×</button>
                </div>

                {/* O DINHEIRO da linha. Aparece sempre que ela falou valor, e
                    diz em letras grandes qual leitura o sistema fez — porque
                    trocar "cada" por "total" multiplica o custo pela
                    quantidade, e esse erro entra calado no CMV. */}
                {l.dinheiro && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 12.5, color: C.muted, flex: 1, minWidth: 140, lineHeight: 1.45 }}>
                      <b style={{ color: C.text }}>{brl(l.dinheiro.total)}</b> no total
                      {l.dinheiro.custoUnit != null && (
                        <> · <b style={{ color: C.text }}>{brl(l.dinheiro.custoUnit)}</b> por {l.unidade}</>
                      )}
                    </div>
                    <button type="button" onClick={() => trocarTipoPreco(l.id)}
                      style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.accent, borderRadius: 999, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      {l.dinheiro.tipo === 'total' ? 'era o preço de cada' : 'era o total'}
                    </button>
                  </div>
                )}

                {l.nivel !== 'ok' && (
                  <>
                    <div style={{ fontSize: 12, color: l.nivel === 'confira' ? C.amber : C.red, marginBottom: 7, lineHeight: 1.4 }}>{l.recado}</div>
                    <select value={l.item ? l.item.id : ''} onChange={(e) => trocarItem(l.id, e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
                      <option value="">— escolher item —</option>
                      {ordenados.map((it) => <option key={it.id} value={it.id}>{limparNome(it.nome)} ({it.unidade || 'un'})</option>)}
                    </select>
                  </>
                )}
              </div>
            );
          })}

          {sobra && (
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, marginBottom: 8, lineHeight: 1.45 }}>
              Não usei isto da tua frase: "{sobra}"
            </div>
          )}

          {/* Preco dito NAO vira despesa. O abastecimento por voz mexe no saldo
              e no custo; fornecedor, forma de pagamento e contas a pagar moram
              nas Compras. Dizer isso aqui evita ela achar que o financeiro do
              mes ja esta fechado. */}
          {temDinheiro > 0 && (
            <div style={{ fontSize: 12, color: C.muted, background: C.panel2, borderRadius: 10, padding: '10px 12px', margin: '2px 0 10px', lineHeight: 1.5 }}>
              Total falado: <b style={{ color: C.text }}>{brl(temDinheiro)}</b>. Escolhe um dos dois:
              <div style={{ marginTop: 6 }}>
                <b style={{ color: C.text }}>Lançar como compra</b> — vai pra tela de Compras com tudo
                {' '}preenchido. Tu escolhe fornecedor e forma de pagamento, e a nota entra no estoque,
                {' '}no custo e na <b style={{ color: C.text }}>despesa</b> de uma vez.
              </div>
              <div style={{ marginTop: 4 }}>
                <b style={{ color: C.text }}>Só abastecer</b> — sobe o saldo e o custo, <b>sem</b> lançar despesa.
                {' '}É pro que não tem nota.
              </div>
              <div style={{ marginTop: 6, color: C.amber, fontWeight: 600 }}>
                Um ou outro — fazer os dois soma a mesma mercadoria duas vezes.
              </div>
            </div>
          )}

          {temDinheiro > 0 && onLevarPraCompras && (
            <Btn onClick={paraCompras} disabled={busy || !prontas.some((l) => l.dinheiro && l.dinheiro.custoUnit > 0)} style={{ width: '100%', marginBottom: 8 }}>
              Lançar como compra
            </Btn>
          )}

          <Btn kind={temDinheiro > 0 ? 'ghost' : 'primary'} onClick={gravar} disabled={busy || !prontas.length} style={{ width: '100%', marginTop: temDinheiro > 0 ? 0 : 6 }}>
            {busy ? 'Abastecendo…' : prontas.length ? (temDinheiro > 0 ? `Só abastecer ${prontas.length} ${prontas.length === 1 ? 'item' : 'itens'}` : `Abastecer ${prontas.length} ${prontas.length === 1 ? 'item' : 'itens'}`) : 'Resolve as linhas acima'}
          </Btn>
        </div>
      )}
    </Card>
  );
}
