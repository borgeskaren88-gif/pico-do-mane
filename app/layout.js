import './globals.css';

export const metadata = {
  title: 'PicoOS — Central de Gestão',
  description: 'Painel de gestão do PicoOS',
  manifest: '/manifest.webmanifest',
  applicationName: 'PicoOS',
  appleWebApp: {
    capable: true,
    title: 'PicoOS',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/favicon-32.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#0A1220',
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
            __html: `(function(){try{var t=localStorage.getItem('picoos-tema');if(t!=='claro'&&t!=='escuro')t='escuro';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
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
