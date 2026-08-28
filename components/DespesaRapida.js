'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, PageTitle, SecTitle, Empty } from './ui';
import { uid, num, brl, todayISO, CATEGORIAS_DESPESA } from '../lib/util';
import { parseDespesaFala } from '../lib/despesaFala';

// Despesa Rápida: fala/digita "supermercado 45,90" e o app entende valor,
// categoria e descrição. Feita pra um toque só (ex.: Botão de Ação do iPhone).
export default function DespesaRapida({ dados = [], onChange, textoInicial = '' }) {
  const [texto, setTexto] = useState(textoInicial || '');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [feitos, setFeitos] = useState([]); // lançados nesta sessão (confirmação visual)
  const [msg, setMsg] = useState('');
  const ref = useRef(null);
  const ultimoTexto = useRef('');

  // Sempre que o texto muda, reinterpreta (valor/categoria/descrição).
  useEffect(() => {
    if (texto === ultimoTexto.current) return;
    ultimoTexto.current = texto;
    if (!texto.trim()) { setValor(''); setCategoria(''); setDescricao(''); return; }
    const r = parseDespesaFala(texto);
    setValor(r.valor ? String(r.valor).replace('.', ',') : '');
    setCategoria(r.categoria || 'A classificar');
    setDescricao(r.descricao || '');
  }, [texto]);

  // Preenche a partir do que veio na URL (atalho do iPhone) e foca o campo.
  useEffect(() => {
    if (textoInicial) setTexto(textoInicial);
    if (ref.current) { try { ref.current.focus(); } catch { /* ignora */ } }
  }, [textoInicial]);

  const catOptions = useMemo(() => ['A classificar', ...CATEGORIAS_DESPESA.filter((c) => c !== 'A classificar')], []);
  const podeSalvar = num(valor) > 0;

  const lancar = () => {
    if (!podeSalvar || !onChange) { setMsg('Diga ou digite pelo menos o valor (ex.: "supermercado 45").'); return; }
    const nova = { id: uid(), data: todayISO(), categoria: categoria || 'A classificar', descricao: (descricao || '').trim(), valor: num(valor), obs: 'Lançado por voz' };
    onChange([nova, ...dados]);
    setFeitos((f) => [nova, ...f].slice(0, 8));
    setMsg(`Lançado: ${brl(nova.valor)} em ${nova.categoria} ✓`);
    setTexto(''); setValor(''); setCategoria(''); setDescricao(''); ultimoTexto.current = '';
    if (ref.current) { try { ref.current.focus(); } catch { /* ignora */ } }
  };

  return (
    <div>
      <PageTitle sub="Fale pelo microfone do teclado — ex.: “supermercado 45,90”">Despesa Rápida</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          Toque no campo abaixo e use o <b style={{ color: C.text }}>🎤 microfone do teclado</b> (ou digite). Diga o lugar/coisa e o valor, tipo <i>“feira do supermercado 45 e 90”</i> ou <i>“gelo 30 reais”</i>. O app entende sozinho — é só conferir e lançar.
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Field label="O que você gastou?">
          <textarea
            ref={ref}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: supermercado 45,90"
            rows={2}
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', background: C.panel, color: C.text, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 14px', fontSize: 18, resize: 'none', outline: 'none' }}
          />
        </Field>

        {/* Prévia do que o app entendeu — tudo editável antes de lançar. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
          <Field label="Valor (R$)"><NumInput value={valor} onChange={setValor} placeholder="0,00" /></Field>
          <Field label="Categoria"><Select value={categoria} onChange={setCategoria} options={catOptions} placeholder="Categoria" /></Field>
        </div>
        <Field label="Descrição"><TextInput value={descricao} onChange={setDescricao} placeholder="Ex.: Supermercado" /></Field>

        {valor && categoria === 'A classificar' && (
          <div style={{ fontSize: 12, color: C.amber, margin: '2px 0 10px' }}>Não reconheci a categoria — deixei em “A classificar”. Você pode escolher acima (ou ajustar depois em Finanças).</div>
        )}

        <Btn onClick={lancar} disabled={!podeSalvar} style={{ width: '100%', fontSize: 17, padding: '14px' }}>Lançar despesa</Btn>
        {msg && <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: msg.startsWith('Lançado') ? C.green : C.amber }}>{msg}</div>}
      </Card>

      <SecTitle>Lançadas agora ({feitos.length})</SecTitle>
      {feitos.length === 0 ? <Empty>As despesas que você lançar aqui aparecem nesta lista e já entram em Finanças.</Empty> : (
        <div>
          {feitos.map((d) => (
            <Card key={d.id} style={{ marginBottom: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{d.categoria}</div>
                  {d.descricao && <div style={{ fontSize: 12, color: C.faint }}>{d.descricao}</div>}
                </div>
                <div style={{ fontWeight: 800, color: C.red, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(num(d.valor))}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
