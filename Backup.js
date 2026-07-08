'use client';
import React, { useState } from 'react';
import { C, Card, Btn, KPI, Area, inputStyle } from './ui';
import { todayISO } from '../lib/util';
import SEED_DATA from '../data/seed.json';

export default function Backup({ all, restore }) {
  const [msg, setMsg] = useState('');
  const [importText, setImportText] = useState('');
  const jsonStr = JSON.stringify(all, null, 2);

  const baixar = (conteudo, nome, tipo) => {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url); setMsg('Arquivo gerado. Verifique seus downloads.');
  };
  const q = (x) => `"${(x == null ? '' : String(x)).replace(/"/g, '""')}"`;
  const baixarCSV = () => {
    const L = [];
    L.push('=== RECEITAS ===', 'Data,Fonte,Descrição,Valor,Obs');
    all.receitas.forEach((r) => L.push([r.data, r.categoria, r.descricao, r.valor, r.obs].map(q).join(',')));
    L.push('', '=== DESPESAS ===', 'Data,Categoria,Descrição,Valor,Obs');
    all.despesas.forEach((r) => L.push([r.data, r.categoria, r.descricao, r.valor, r.obs].map(q).join(',')));
    L.push('', '=== COMPRAS ===', 'Data,Produto,Fornecedor,Qtd,ValorUnit,FormaPagto,Vencimento,Pago,DataPagamento');
    all.compras.forEach((r) => L.push([r.data, r.produto, r.fornecedor, r.quantidade, r.valorUnit, r.formaPagto, r.vencimento, r.pago, r.dataPagamento].map(q).join(',')));
    L.push('', '=== COTAÇÕES ===', 'Data,Produto,Fornecedor,Preço,Categoria');
    all.cotacoes.forEach((r) => L.push([r.data, r.produto, r.fornecedor, r.preco, r.categoria].map(q).join(',')));
    L.push('', '=== GARRAFAS ===', 'Produto,Volume(ml),Dose(ml),Abertura,Término,Drinks,Obs');
    all.garrafas.forEach((r) => L.push([r.produto, r.volume, r.dose, r.dataAbertura, r.dataTermino, r.drinks, r.obs].map(q).join(',')));
    L.push('', '=== DIÁRIO ===', 'Data,Clima,Evento,Receita,Pedidos,Fiado,Nota,Problema,Decisão,Aprendizado,Prioridade');
    all.diario.forEach((r) => L.push([r.data, r.clima, r.evento, r.receita, r.nPedidos, r.fiado, r.nota, r.problema, r.decisao, r.aprendizado, r.prioridade].map(q).join(',')));
    baixar('\ufeff' + L.join('\n'), `pico-do-mane-${todayISO()}.csv`, 'text/csv;charset=utf-8');
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(jsonStr); setMsg('Dados copiados! Cole no chat com o Claude para análise.'); }
    catch { setMsg('Não consegui copiar automático. Abra "Ver dados brutos" abaixo, selecione e copie.'); }
  };
  const importar = () => {
    try { restore(JSON.parse(importText)); setMsg('Dados restaurados com sucesso.'); setImportText(''); }
    catch { setMsg('JSON inválido. Cole exatamente o conteúdo de um backup.'); }
  };
  const [confirmarRecarregar, setConfirmarRecarregar] = useState(false);
  const recarregarOriginais = () => {
    if (!confirmarRecarregar) { setConfirmarRecarregar(true); return; }
    try {
      if (!SEED_DATA || !SEED_DATA.diario) {
        setMsg('Erro: os dados originais não foram encontrados. Tente recarregar a página e tentar de novo.');
        setConfirmarRecarregar(false);
        return;
      }
      restore(SEED_DATA);
      setConfirmarRecarregar(false);
      setMsg('Dados originais das planilhas recarregados.');
    } catch (e) {
      setMsg('Erro ao recarregar: ' + (e && e.message ? e.message : String(e)));
      setConfirmarRecarregar(false);
    }
  };
  const total = all.diario.length + all.receitas.length + all.despesas.length + all.compras.length + all.cotacoes.length + all.garrafas.length;

  return (
    <div>
      <Card style={{ marginBottom: 14, borderColor: C.accent }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.accent, fontWeight: 700, marginBottom: 6 }}>Sobre os dados carregados</div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 12 }}>
          Este painel já veio populado com o que estava nas suas 3 planilhas (DRE, Cotação de Fornecedores e Diário do Gestor) de maio a julho/2026, transcrito exatamente como estava lá. Uma única exceção: no Diário do dia 05/07, os campos de texto (problema, decisão, aprendizado, prioridade e nota) vieram corrompidos no PDF exportado — o texto original ficou sobreposto e ilegível, então não preenchi para não inventar dado. Vale conferir e completar esse dia manualmente.
        </div>
        {!confirmarRecarregar ? (
          <Btn kind="ghost" small onClick={recarregarOriginais}>↺ Recarregar dados originais das planilhas</Btn>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: C.amber, marginBottom: 8, fontWeight: 600 }}>Isso substitui TUDO que está no painel agora pelos dados originais das planilhas. Confirma?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind="danger" small onClick={recarregarOriginais}>Sim, recarregar</Btn>
              <Btn kind="ghost" small onClick={() => setConfirmarRecarregar(false)}>Cancelar</Btn>
            </div>
          </div>
        )}
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.startsWith('Erro') ? C.red : C.accent }}>{msg}</div>}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Seus dados</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 14 }}>Tudo é salvo automaticamente e continua aqui quando você voltar. Guarde um backup de vez em quando e use "Copiar" quando quiser que eu analise seus números.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <KPI titulo="Diário" valor={all.diario.length} />
          <KPI titulo="Receitas" valor={all.receitas.length} />
          <KPI titulo="Despesas" valor={all.despesas.length} />
          <KPI titulo="Compras" valor={all.compras.length} />
          <KPI titulo="Cotações" valor={all.cotacoes.length} />
          <KPI titulo="Garrafas" valor={all.garrafas.length} />
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Exportar</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Btn onClick={() => baixar(jsonStr, `pico-do-mane-${todayISO()}.json`, 'application/json')}>⬇ Baixar backup completo (JSON)</Btn>
          <Btn kind="ghost" onClick={baixarCSV}>⬇ Baixar planilha (CSV para Excel/Sheets)</Btn>
          <Btn kind="ghost" onClick={copiar}>📋 Copiar dados para o Claude analisar</Btn>
        </div>
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: C.accent }}>{msg}</div>}
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Restaurar backup</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>Cole o conteúdo de um backup JSON. Atenção: substitui os dados atuais.</div>
        <Area value={importText} onChange={setImportText} rows={4} placeholder='{ "diario": [...], "receitas": [...] }' />
        <div style={{ marginTop: 10 }}><Btn kind="ghost" onClick={importar}>Restaurar dados</Btn></div>
      </Card>

      <details style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: C.muted }}>Ver dados brutos ({total} registros)</summary>
        <textarea readOnly value={jsonStr} style={{ ...inputStyle, marginTop: 12, height: 200, fontSize: 11, fontFamily: 'monospace' }} />
      </details>
    </div>
  );
}

