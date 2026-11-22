'use client';
import React, { useMemo, useState } from 'react';
import { C, Card, Btn, TextInput } from './ui';
import { brl, limparNome } from '../lib/util';
import { analisarPrecos, resumoDasCompras, montarPedidos } from '../lib/inteligenciaCompras';

// O COMPRADOR ESPERTO, no topo das Cotações.
//
// Lê as notas de Compras e as cotações juntas e responde as três perguntas de
// quem vai fazer pedido: onde está mais barato, quanto eu deixo de economizar
// por mês, e — com a lista de compras na mão — o pedido de cada fornecedor,
// pronto pra mandar no WhatsApp.

const ddmm = (d) => (d && d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');
const un = (u) => (u ? `/${u}` : '');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Ranking({ a }) {
  return (
    <div style={{ marginTop: 8 }}>
      {a.fornecedores.map((f, i) => (
        <div key={f.fornecedor + f.data} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '4px 0', borderTop: i ? `1px solid ${C.hair}` : 'none' }}>
          <span style={{ minWidth: 0 }}>
            <b style={{ color: i === 0 ? C.green : C.text }}>{i === 0 ? '★ ' : ''}{f.fornecedor}</b>
            <span style={{ color: C.faint, fontSize: 11.5 }}> · {f.fonte === 'nota' ? `nota de ${ddmm(f.data)}` : `cotação de ${ddmm(f.data)}`}{f.vezes > 1 ? ` · ${f.vezes} compras` : ''}</span>
          </span>
          <b style={{ color: i === 0 ? C.green : C.text, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(f.unit)}<span style={{ fontSize: 10.5, color: C.faint, fontWeight: 400 }}>{un(a.unidade)}</span></b>
        </div>
      ))}
    </div>
  );
}

export default function CompradorEsperto({ compras = [], cotacoes = [], estoque = [], listaCompras = [] }) {
  const analise = useMemo(() => analisarPrecos({ compras, cotacoes, estoque }), [compras, cotacoes, estoque]);
  const resumo = useMemo(() => resumoDasCompras(analise), [analise]);
  const [busca, setBusca] = useState('');
  const [verPedido, setVerPedido] = useState(false);
  const [copiado, setCopiado] = useState('');
  const achados = useMemo(() => {
    const q = norm(busca.trim());
    if (q.length < 2) return [];
    return analise.filter((a) => norm(a.nome).includes(q)).slice(0, 6);
  }, [busca, analise]);
  const pendentes = (Array.isArray(listaCompras) ? listaCompras : []).filter((i) => i && !i.comprado && i.nome);
  const pedido = useMemo(() => (verPedido ? montarPedidos(listaCompras, analise, cotacoes, estoque) : null), [verPedido, listaCompras, analise, cotacoes, estoque]);

  const copiar = async (texto, chave) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(chave); setTimeout(() => setCopiado(''), 2500); } catch { /* sem permissão */ }
  };

  if (!analise.length) {
    return (
      <Card data-comprador style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Onde comprar mais barato</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>Assim que tiver notas lançadas em Compras (ou preços aqui embaixo), eu comparo os fornecedores sozinho e te digo onde comprar cada coisa.</div>
      </Card>
    );
  }

  return (
    <div data-comprador style={{ marginBottom: 18 }}>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Onde comprar mais barato</div>
        <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2, lineHeight: 1.5 }}>
          Pelas tuas notas de Compras e pelas cotações, tudo no preço por unidade do estoque. Vale o preço mais recente de cada fornecedor.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <div style={{ flex: '1 1 160px', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, color: C.faint, fontWeight: 800, letterSpacing: '.06em' }}>DÁ PRA ECONOMIZAR</div>
            <div data-economia-mes style={{ fontSize: 21, fontWeight: 900, color: resumo.economiaMes > 0 ? C.green : C.text, marginTop: 2 }}>{brl(resumo.economiaMes)}<span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}> por mês</span></div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>comprando cada coisa no mais barato, no teu consumo</div>
          </div>
          {resumo.campeao && (
            <div style={{ flex: '1 1 160px', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: C.faint, fontWeight: 800, letterSpacing: '.06em' }}>MAIS BARATO EM MAIS COISAS</div>
              <div style={{ fontSize: 19, fontWeight: 900, marginTop: 2 }}>{resumo.campeao.fornecedor}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>em {resumo.campeao.produtos} {resumo.campeao.produtos === 1 ? 'produto' : 'produtos'}</div>
            </div>
          )}
        </div>
      </Card>

      {resumo.economias.length > 0 && (
        <Card data-economias style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14.5, fontWeight: 900, marginBottom: 6 }}>Onde tu estás pagando mais caro</div>
          {resumo.economias.map((a) => (
            <div key={a.chave} style={{ padding: '8px 0', borderTop: `1px solid ${C.hair}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 14 }}>{a.nome}</b>
                <b style={{ fontSize: 13, color: C.green, flexShrink: 0 }}>−{brl(a.economiaMes)}/mês</b>
              </div>
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>{a.texto}</div>
            </div>
          ))}
        </Card>
      )}

      {resumo.subiram.length > 0 && (
        <Card data-subiram style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14.5, fontWeight: 900, marginBottom: 6 }}>Subiram de preço na última compra</div>
          {resumo.subiram.map((a) => (
            <div key={a.chave} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '5px 0', borderTop: `1px solid ${C.hair}` }}>
              <span style={{ minWidth: 0 }}>{a.nome} <span style={{ color: C.faint, fontSize: 11.5 }}>· {brl(a.anterior.unit)} → {brl(a.ultima.unit)}{un(a.unidade)} ({a.ultima.fornecedor}, {ddmm(a.ultima.data)})</span></span>
              <b style={{ color: C.red, flexShrink: 0 }}>+{a.subiu}%</b>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>Vale pedir preço pra outro fornecedor desses antes da próxima compra.</div>
        </Card>
      )}

      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14.5, fontWeight: 900, marginBottom: 8 }}>Quanto custa em cada fornecedor?</div>
        <TextInput value={busca} onChange={setBusca} placeholder="Digita o produto: heineken, gelo, limão…" />
        {busca.trim().length >= 2 && !achados.length && <div style={{ fontSize: 13, color: C.faint, marginTop: 8 }}>Nada com esse nome nas tuas notas nem nas cotações.</div>}
        {achados.map((a) => (
          <div key={a.chave} data-achado={a.nome} style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>{a.nome}</div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>{a.texto}</div>
            <Ranking a={a} />
          </div>
        ))}
      </Card>

      <Card data-montar-pedido>
        <div style={{ fontSize: 14.5, fontWeight: 900 }}>Montar o pedido pela lista de compras</div>
        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>
          {pendentes.length
            ? `${pendentes.length} ${pendentes.length === 1 ? 'item' : 'itens'} na lista. Eu divido pelo fornecedor mais barato de cada um e deixo a mensagem pronta.`
            : 'A lista de compras está vazia. Põe os itens lá (Abastecimento → Lista) e volta aqui.'}
        </div>
        {pendentes.length > 0 && !verPedido && <div style={{ marginTop: 10 }}><Btn onClick={() => setVerPedido(true)}>Montar pedido</Btn></div>}
        {pedido && (
          <div style={{ marginTop: 10 }}>
            {pedido.pedidos.map((p) => (
              <div key={p.fornecedor} data-pedido={p.fornecedor} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 12px', marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontSize: 14.5 }}>{p.fornecedor}</b>
                  {p.total > 0 && <b style={{ fontSize: 13.5 }}>≈ {brl(p.total)}</b>}
                </div>
                {p.itens.map((i) => (
                  <div key={i.nome} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: C.muted, padding: '2px 0' }}>
                    <span>{i.quantidade ? `${i.quantidade} × ` : ''}{i.nome}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{brl(i.unit)}{un(i.unidade)}</span>
                  </div>
                ))}
                {p.abaixoDoMinimo && <div style={{ fontSize: 12, color: C.amber, marginTop: 4 }}>Abaixo do pedido mínimo dele ({brl(p.minPedido)}). Junta com outro pedido ou vê se compensa no segundo mais barato.</div>}
                {p.prazoEntrega > 0 && <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4 }}>Entrega em {p.prazoEntrega} dia(s){p.prazoPag > 0 ? ` · ${p.prazoPag} dias pra pagar` : ''}.</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <Btn small href={`https://wa.me/?text=${encodeURIComponent(p.mensagem)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'inline-block' }}>Mandar no WhatsApp</Btn>
                  <Btn small kind="ghost" onClick={() => copiar(p.mensagem, p.fornecedor)}>{copiado === p.fornecedor ? 'Copiado!' : 'Copiar'}</Btn>
                </div>
              </div>
            ))}
            {pedido.semPreco.length > 0 && (
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
                Sem preço em lugar nenhum ainda: {pedido.semPreco.map(limparNome).join(', ')}. Cota esses aqui embaixo.
              </div>
            )}
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8 }}>O total é estimado pelo último preço de cada um. Confirma com o fornecedor.</div>
          </div>
        )}
      </Card>
    </div>
  );
}
