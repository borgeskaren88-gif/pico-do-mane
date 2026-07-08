export const metadata = {
  title: 'PicoOs — Central de Gestão',
  description: 'Painel de gestão do PicoOs',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
