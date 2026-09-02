import './globals.css';

export const metadata = {
  title: 'Nossa Casa',
  description: 'Finanças, hábitos e lista de compras do casal, com um login para cada um.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Nossa Casa',
  appleWebApp: {
    capable: true,
    title: 'Nossa Casa',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#1A130B',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('financas-tema');if(t!=='claro'&&t!=='escuro')t='escuro';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body style={{ margin: 0 }}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); }); }`,
          }}
        />
      </body>
    </html>
  );
}
