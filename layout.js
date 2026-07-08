export const metadata = {
  title: 'Pico do Mané — Central de Gestão',
  description: 'Painel de gestão do Pico do Mané',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
