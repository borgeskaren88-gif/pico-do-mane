// A CONTA DA MESA EM PDF — com cara de cupom.
//
// "O cliente pediu a conta impressa e eu não consegui." No iPhone, com o
// PicoOS instalado na tela inicial, o "imprimir" do navegador não faz nada
// (já caímos nisso nos relatórios). Um ARQUIVO PDF, ao contrário, vai pra folha
// de compartilhar do celular — e ali tem Imprimir (AirPrint), WhatsApp e
// Salvar. No computador, abre no leitor de PDF, que imprime.
//
// O PDF é escrito aqui mesmo, à mão, sem biblioteca: é texto numa coluna,
// com fonte de máquina (Courier) — a de cupom. Um gerador de PDF inteiro
// seriam centenas de KB baixados no 4G do bar pra fazer isto.
//
// Largura de 80 mm, a da bobina de impressora térmica; a altura cresce com a
// conta. Em impressora comum sai uma tira, igual a um cupom.

const LARGURA = 226.77; // 80 mm em pontos
const MARGEM = 12;      // em cima e embaixo
const MARGEM_X = 21;    // dos lados: 34 letras × 5,4 pt = 183,6 pt, centrado nos 226,8
const COLUNAS = 34;     // Courier 9 pt: 5,4 pt por letra → 34 cabem na bobina
const CORPO = 9;
const ENTRE = 11.2;     // distância entre linhas

// Dinheiro sem espaço especial (o espaço "duro" do brl da tela vira lixo em
// algumas impressoras).
export const reais = (v) => {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
};

// Do texto do app pros bytes que a fonte padrão do PDF entende (WinAnsi):
// os acentos do português ficam iguais ao Latin-1; traços e aspas "bonitas"
// têm lugar próprio; o resto (emoji, por exemplo) vira espaço, pra não
// aparecer um quadrado no papel do cliente.
const ESPECIAIS = { 8211: 150, 8212: 151, 8226: 149, 8230: 133, 8216: 145, 8217: 146, 8220: 147, 8221: 148, 8364: 128 };
function paraPdf(txt) {
  let out = '';
  for (const ch of String(txt || '')) {
    const c = ch.codePointAt(0);
    let b;
    if (c === 40 || c === 41 || c === 92) { out += `\\${ch}`; continue; }
    if (c >= 32 && c < 127) { out += ch; continue; }
    if (c >= 160 && c <= 255) b = c === 160 ? 32 : c;
    else b = ESPECIAIS[c] || 32;
    out += b === 32 ? ' ' : `\\${b.toString(8).padStart(3, '0')}`;
  }
  return out;
}

// Quebra um texto em pedaços de no máximo `n` letras, nas palavras.
function quebrar(txt, n) {
  const palavras = String(txt || '').replace(/\s+/g, ' ').trim().split(' ');
  const linhas = [];
  let atual = '';
  for (let p of palavras) {
    while (p.length > n) { if (atual) { linhas.push(atual); atual = ''; } linhas.push(p.slice(0, n)); p = p.slice(n); }
    if (!p) continue;
    if (!atual) atual = p;
    else if ((atual + ' ' + p).length <= n) atual += ' ' + p;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}
const lado = (esq, dir, n = COLUNAS) => {
  const e = String(esq); const d = String(dir);
  return e + ' '.repeat(Math.max(1, n - e.length - d.length)) + d;
};
const centro = (t, n) => { const s = String(t).slice(0, n); return ' '.repeat(Math.floor((n - s.length) / 2)) + s; };

// As linhas do cupom, já do tamanho da bobina. Separado do PDF pra poder
// conferir o texto sem precisar ler PDF.
export function linhasDoCupom(c) {
  const L = [];
  const add = (texto, extra = {}) => L.push({ texto, ...extra });
  const traco = () => add('-'.repeat(COLUNAS));
  const titulo = String(c.negocio || 'Conta').toUpperCase();
  // O nome do bar em letra maior (11 pt = 6,6 pt por letra): 28 cabem na mesma largura.
  for (const t of quebrar(titulo, 28)) add(centro(t, 28), { tam: 11, negrito: true });
  if (c.cidade) add(centro(c.cidade, COLUNAS));
  traco();
  add(c.mesa === 'Balcão' || !c.mesa ? 'CONTA' : `CONTA DA MESA ${c.mesa}`, { negrito: true });
  if (c.cliente) for (const t of quebrar(`Cliente: ${c.cliente}`, COLUNAS)) add(t);
  if (c.pessoas > 0) add(`Pessoas: ${c.pessoas}`);
  if (c.quando) add(c.quando);
  traco();
  const itens = (c.itens || []).filter((it) => (Number(it.qtd) || 0) > 0);
  if (!itens.length) add('Nenhum item lançado.');
  for (const it of itens) {
    const q = Number(it.qtd) || 0;
    const valor = reais(q * (Number(it.preco) || 0)).replace('R$ ', '');
    const partes = quebrar(`${String(q).replace('.', ',')}x ${it.nome || 'Item'}`, COLUNAS - valor.length - 1);
    partes.forEach((p, i) => add(i === partes.length - 1 ? lado(p, valor) : p));
    if (q > 1) add(`   ${reais(it.preco)} cada`);
    if (it.obs) for (const t of quebrar(`   obs: ${it.obs}`, COLUNAS)) add(t);
  }
  traco();
  add(lado('Subtotal', reais(c.subtotal)));
  if (c.servicoVal > 0) add(lado('Serviço (10%)', reais(c.servicoVal)));
  add(lado('TOTAL', reais(c.total)), { negrito: true });
  const pago = Math.round((Number(c.jaPago) || 0) * 100) / 100;
  const falta = Math.round((c.total - pago) * 100) / 100;
  if (pago > 0.005) {
    add(lado('Já pago', reais(pago)));
    add(lado('FALTA PAGAR', reais(falta)), { negrito: true });
  }
  if (c.pessoas > 1 && falta > 0.005) add(lado(`Dividido por ${c.pessoas}`, `${reais(Math.round((falta / c.pessoas) * 100) / 100)} cada`));
  traco();
  add(centro('Obrigado pela visita!', COLUNAS));
  add(centro('Não é documento fiscal.', COLUNAS), { tam: 8 });
  return L;
}

// O ARQUIVO. PDF 1.4 com uma página só, duas fontes padrão (que todo leitor
// de PDF já tem — nada embutido) e o texto solto, sem compressão.
export function gerarCupomPdf(conta) {
  const linhas = linhasDoCupom(conta);
  const altura = Math.max(200, Math.ceil(MARGEM * 2 + linhas.reduce((s, l) => s + (l.tam ? l.tam + 3.5 : ENTRE), 0) + 6));
  let y = altura - MARGEM - 9;
  let fluxo = '';
  for (const l of linhas) {
    const tam = l.tam || CORPO;
    fluxo += `BT /${l.negrito ? 'F2' : 'F1'} ${tam} Tf ${MARGEM_X} ${y.toFixed(2)} Td (${paraPdf(l.texto)}) Tj ET\n`;
    y -= l.tam ? l.tam + 3.5 : ENTRE;
  }
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${LARGURA} ${altura}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${fluxo.length} >>\nstream\n${fluxo}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${paraPdf(conta.titulo || 'Conta')}) /Producer (PicoOS) >>`,
  ];
  // Tudo aqui é ASCII (os acentos viraram \ooo), então letra = byte e as
  // posições do índice (xref) batem.
  let pdf = '%PDF-1.4\n';
  const pos = [];
  objetos.forEach((o, i) => { pos.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of pos) pdf += `${String(p).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
