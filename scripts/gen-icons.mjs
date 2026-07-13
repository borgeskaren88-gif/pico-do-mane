// Gera os ícones PNG do PWA renderizando um SVG no Chromium (Playwright).
// Roda uma vez, offline, e grava em public/icons + public/. Não faz parte
// do build do site — é só uma ferramenta pra (re)gerar os ícones.
// Aceita o Playwright instalado no projeto OU global (o caminho global é o
// fallback usado no ambiente onde os ícones foram gerados).
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = (await import('/opt/node22/lib/node_modules/playwright/index.js')).default);
}
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outIcons = path.join(root, 'public', 'icons');
fs.mkdirSync(outIcons, { recursive: true });

// Ícone de gestão minimalista: fundo em degradê azul moderno (full-bleed —
// o próprio sistema arredonda os cantos) + uma seta de crescimento pra cima.
// Desenhado num quadro 0..100 e escalado pro tamanho pedido. `maskable`
// reduz o símbolo pra caber na "safe zone" (o launcher do Android recorta
// as bordas).
const svg = (size, { maskable = false } = {}) => {
  const g = maskable
    ? 'translate(50 50) scale(0.78) translate(-50 -50)'
    : 'translate(0 0)';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"    stop-color="#1652E8"/>
      <stop offset="0.55" stop-color="#2C86F5"/>
      <stop offset="1"    stop-color="#38D2F0"/>
    </linearGradient>
    <radialGradient id="gloss" cx="0.28" cy="0.20" r="0.9">
      <stop offset="0"   stop-color="#FFFFFF" stop-opacity="0.20"/>
      <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="100" height="100" fill="url(#bg)"/>
  <rect width="100" height="100" fill="url(#gloss)"/>

  <g transform="${g}" fill="none" stroke="#FFFFFF" stroke-width="9"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M26 70 L74 30"/>
    <path d="M58 30 L74 30 L74 46"/>
  </g>
</svg>`;
};

const targets = [
  { file: path.join(outIcons, 'icon-192.png'), size: 192 },
  { file: path.join(outIcons, 'icon-512.png'), size: 512 },
  { file: path.join(outIcons, 'icon-maskable-512.png'), size: 512, maskable: true },
  // iOS arredonda sozinho; mantém full-bleed
  { file: path.join(root, 'public', 'apple-touch-icon.png'), size: 180 },
  { file: path.join(root, 'public', 'favicon-32.png'), size: 32 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const data = 'data:image/svg+xml;base64,' + Buffer.from(svg(t.size, { maskable: t.maskable })).toString('base64');
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.goto(data);
  await page.screenshot({ path: t.file, omitBackground: false });
  console.log('gerado:', path.relative(root, t.file));
}
await browser.close();
