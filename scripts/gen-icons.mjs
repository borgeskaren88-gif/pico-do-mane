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

// Marca "PO" sobre o gradiente da marca. safe = fração ocupada pelo texto
// (menor = mais margem, usado no ícone "maskable" pra não cortar nas bordas).
const svg = (size, safe = 0.62, radius = 0) => {
  const fs2 = Math.round(size * safe * 0.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4C93F5"/>
      <stop offset="1" stop-color="#7FB2FA"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.02em" text-anchor="middle" dominant-baseline="central"
    font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    font-weight="900" font-size="${fs2}" letter-spacing="-0.02em" fill="#06101F">PO</text>
</svg>`;
};

const targets = [
  { file: path.join(outIcons, 'icon-192.png'), size: 192, safe: 0.62, radius: 0 },
  { file: path.join(outIcons, 'icon-512.png'), size: 512, safe: 0.62, radius: 0 },
  // maskable: texto menor (dentro da "safe zone" de ~80%) pra não cortar
  { file: path.join(outIcons, 'icon-maskable-512.png'), size: 512, safe: 0.48, radius: 0 },
  // iOS arredonda sozinho; mantém full-bleed
  { file: path.join(root, 'public', 'apple-touch-icon.png'), size: 180, safe: 0.62, radius: 0 },
  { file: path.join(root, 'public', 'favicon-32.png'), size: 32, safe: 0.7, radius: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const data = 'data:image/svg+xml;base64,' + Buffer.from(svg(t.size, t.safe, t.radius)).toString('base64');
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.goto(data);
  await page.screenshot({ path: t.file, omitBackground: false });
  console.log('gerado:', path.relative(root, t.file));
}
await browser.close();
