import ExcelJS from 'exceljs';

// Escreve o pacote (lib/pacoteAnalista.js) num arquivo .xlsx.
//
// Layout de cada aba, sempre igual — é o que deixa as fórmulas apontarem pro
// lugar certo:
//   linha 1 ........ o nome da aba, em destaque
//   linhas seguintes  as notas (como o número foi calculado)
//   parâmetros ..... células AMARELAS que o analista pode mudar (as fórmulas usam)
//   (linha em branco)
//   cabeçalho ...... filtro ligado e linha congelada
//   dados .......... com formato de dinheiro, % e data
//   total .......... uma linha de soma (SUM de verdade) nas colunas pedidas
//
// Nas fórmulas: {r} = a linha, {p} = a anterior, {P0} {P1}… = os parâmetros.

const FORMATOS = {
  brl: '"R$" #,##0.00', pct: '0.0%', int: '#,##0', num: '#,##0.###', data: 'dd/mm/yyyy',
};
const AZUL = 'FF0F2347';
const AMARELO = 'FFFFF2B3';
const CINZA = 'FFF1F4F9';

export function layoutDe(aba) {
  const n = (aba.notas || []).length;
  const p = (aba.parametros || []).length;
  const cab = (n > 0 || p > 0) ? 2 + n + p + 1 : 2;
  return { primeiraNota: 2, primeiroParametro: 2 + n, cabecalho: cab, primeiraLinha: cab + 1 };
}

const letra = (i) => {
  let s = ''; let n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
const dataExcel = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : null;
};
const nomeSeguro = (n) => String(n).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

export async function escreverXlsx(pacote, { titulo = 'Pacote PicoOS' } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PicoOS';
  wb.created = new Date(pacote.geradoEm || Date.now());
  wb.title = titulo;

  for (const aba of pacote.abas) {
    const ws = wb.addWorksheet(nomeSeguro(aba.nome), { views: [{ showGridLines: true }] });
    const L = layoutDe(aba);
    const cols = aba.colunas || [];
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w || 14; });

    const t = ws.getCell(1, 1);
    t.value = aba.nome; t.font = { bold: true, size: 15, color: { argb: AZUL } };
    // As notas ocupam a LARGURA DA TABELA e quebram linha: nota comprida solta
    // numa célula só sai cortada na borda da tela, e ninguém rola pro lado
    // pra ler "como esse número foi calculado".
    const larguraTotal = cols.reduce((s, c) => s + (c.w || 14), 0) || 60;
    (aba.notas || []).forEach((txt, i) => {
      const r = L.primeiraNota + i;
      const c = ws.getCell(r, 1);
      c.value = txt;
      c.font = { italic: i > 0 || aba.nome !== 'Leia-me', size: 10.5, color: { argb: 'FF445066' }, bold: aba.nome === 'Leia-me' && i === 0 };
      c.alignment = { wrapText: true, vertical: 'top' };
      if (cols.length > 1) ws.mergeCells(r, 1, r, cols.length);
      ws.getRow(r).height = Math.max(16, Math.ceil((String(txt).length * 1.1) / larguraTotal) * 15);
    });
    const pAddr = (aba.parametros || []).map((_, i) => `$B$${L.primeiroParametro + i}`);
    (aba.parametros || []).forEach((p, i) => {
      const a = ws.getCell(L.primeiroParametro + i, 1);
      a.value = p.rotulo; a.font = { bold: true };
      const b = ws.getCell(L.primeiroParametro + i, 2);
      b.value = p.valor; b.numFmt = FORMATOS[p.t] || undefined;
      b.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARELO } };
      b.font = { bold: true }; b.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Cabeçalho
    cols.forEach((c, i) => {
      const cell = ws.getCell(L.cabecalho, i + 1);
      cell.value = c.h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    ws.getRow(L.cabecalho).height = 34;

    const trocar = (f, r, ultima) => String(f)
      .replace(/\{r\}/g, String(r)).replace(/\{p\}/g, String(r - 1))
      .replace(/\{P(\d+)\}/g, (_, k) => pAddr[Number(k)] || '0')
      .replace(/\{first\}/g, String(L.primeiraLinha)).replace(/\{last\}/g, String(ultima));
    const linhas = aba.linhas || [];
    const ultima = L.primeiraLinha + linhas.length - 1;
    const valorDe = (v) => (v && typeof v === 'object' && 'f' in v ? v.v : v);

    linhas.forEach((linha, k) => {
      const r = L.primeiraLinha + k;
      linha.forEach((v, i) => {
        const col = cols[i] || {};
        const cell = ws.getCell(r, i + 1);
        if (v && typeof v === 'object' && 'f' in v) {
          cell.value = { formula: trocar(v.f, r, ultima), result: v.v === '' || v.v == null ? undefined : v.v };
        } else if (col.t === 'data') {
          cell.value = dataExcel(v);
        } else if (v === '' || v == null) {
          cell.value = null;
        } else {
          cell.value = v;
        }
        if (FORMATOS[col.t]) cell.numFmt = FORMATOS[col.t];
        if (col.entrada) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARELO } };
        if (typeof v === 'string' && v.length > 48) cell.alignment = { wrapText: true, vertical: 'top' };
        // Posição, contagens curtas: centralizadas, senão colam no texto da coluna do lado.
        else if (col.t === 'int' && (col.w || 14) <= 12) cell.alignment = { horizontal: 'center' };
      });
      if (k % 2 === 1 && !cols.some((c) => c.entrada)) {
        for (let i = 1; i <= cols.length; i += 1) {
          const c = ws.getCell(r, i);
          if (!c.fill || !c.fill.fgColor) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CINZA } };
        }
      }
    });

    // Linha de total
    if (aba.totais && linhas.length) {
      const r = ultima + 1;
      const rot = ws.getCell(r, 1);
      rot.value = 'Total'; rot.font = { bold: true };
      for (const [iStr, tipo] of Object.entries(aba.totais)) {
        if (tipo !== 'soma') continue;
        const i = Number(iStr);
        const total = Math.round(linhas.reduce((s, ln) => s + (Number(valorDe(ln[i])) || 0), 0) * 1000) / 1000;
        const cell = ws.getCell(r, i + 1);
        cell.value = { formula: `SUM(${letra(i)}${L.primeiraLinha}:${letra(i)}${ultima})`, result: total };
        if (FORMATOS[cols[i] && cols[i].t]) cell.numFmt = FORMATOS[cols[i].t];
        cell.font = { bold: true };
      }
      for (let i = 1; i <= cols.length; i += 1) ws.getCell(r, i).border = { top: { style: 'medium', color: { argb: AZUL } } };
    }

    // Filtro e linha congelada (o Leia-me e o Mapa ficam sem filtro de colunas).
    if (cols.length && linhas.length && aba.nome !== 'Leia-me') {
      ws.autoFilter = { from: { row: L.cabecalho, column: 1 }, to: { row: L.cabecalho, column: cols.length } };
    }
    ws.views = [{ state: 'frozen', ySplit: L.cabecalho, showGridLines: true }];
    // Imprime em paisagem, uma página de largura (e repete o cabeçalho).
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    ws.pageSetup.printTitlesRow = `${L.cabecalho}:${L.cabecalho}`;
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
