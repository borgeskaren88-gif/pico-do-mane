'use client';
import TelaQuebrou from '../components/TelaQuebrou';

// Último anteparo: erro que estourou tão em cima que nem o layout existe mais.
// Aqui a página precisa desenhar <html> e <body> por conta própria — é por isso
// que este arquivo não pode simplesmente reaproveitar o layout do app.
export default function GlobalError({ error, reset }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: '#070B12', color: '#E6EDF6', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', minHeight: '100vh' }}>
        <TelaQuebrou error={error} reset={reset} />
      </body>
    </html>
  );
}
