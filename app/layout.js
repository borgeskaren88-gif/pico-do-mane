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
        {/* O RESGATE DO PEDAÇO QUE NÃO CHEGOU.
            ============================================================
            Isto é a causa da tela que ela fotografou:

                Application error: a client-side exception has occurred
                (see the browser console for more information)

            O app não vem num arquivo só: vem em pedaços, e a página diz o nome
            de cada um. Quando sai versão nova, os pedaços trocam de nome. Se o
            aparelho dela está com a PÁGINA de antes (guardada pra abrir rápido
            e aguentar internet ruim) e vai buscar um pedaço que já não existe
            mais — ou a internet do bar engole o pedido no meio — o navegador
            fica sem metade do programa. Aí o React desiste de tudo de uma vez e
            o app INTEIRO vira aquela frase em inglês.

            Reproduzi isso aqui e confirmei duas coisas ruins:
            1) não é conta errada nem dado torto: é arquivo que faltou;
            2) as telas de erro em português que eu escrevi NÃO salvam esse
               caso, porque elas também moram num pedaço — e o pedaço é
               justamente o que não chegou.

            Então o socorro tem que morar AQUI, escrito dentro da própria
            página, onde não depende de baixar nada. Ele escuta "faltou um
            arquivo do app", joga fora a cópia guardada no aparelho e abre de
            novo — no máximo duas vezes, a segunda com três segundos de espera
            pra dar tempo de a internet voltar. Se depois disso ainda quebrar, aí
            mostra a explicação em português e um botão, em vez da frase em
            inglês.

            Nada disso apaga dado: venda, compra e estoque moram no servidor. O
            que se limpa é só a cópia dos arquivos do app neste aparelho. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var K='picoos:resgate',JANELA=600000,LIMITE=2,agindo=false;
// Quantas vezes já tentei nesta aberta. Passados dez minutos a conta zera: uma
// versão nova semanas depois merece as tentativas dela de novo.
function tentativas(){try{var v=String(sessionStorage.getItem(K)||'').split('|');var n=parseInt(v[0],10),t=parseInt(v[1],10);if(!n||!t||(Date.now()-t)>JANELA)return 0;return n;}catch(e){return 0;}}
function marcar(n){try{sessionStorage.setItem(K,n+'|'+Date.now());}catch(e){}}
function aviso(t,c,bt){try{var d=document.getElementById('picoos-resgate');if(!d){d=document.createElement('div');d.id='picoos-resgate';(document.body||document.documentElement).appendChild(d);}
d.setAttribute('style','position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;background:#070B12;color:#E6EDF6;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center');
d.innerHTML='<div style="max-width:420px"><div style="font-size:20px;font-weight:800;margin-bottom:10px">'+t+'</div><div style="color:#9FB0C6;font-size:14px">'+c+'</div>'+(bt?'<button id="picoos-resgate-bt" style="margin-top:18px;background:#4FC3F7;border:none;color:#06101F;border-radius:10px;padding:12px 20px;font-size:15px;font-weight:800;cursor:pointer">Abrir de novo</button>':'')+'</div>';
var b=document.getElementById('picoos-resgate-bt');if(b)b.onclick=function(){try{sessionStorage.removeItem(K);}catch(e){}limpar(function(){try{location.reload();}catch(e){}});};}catch(e){}}
function limpar(pronto){var fim=false,ok=function(){if(!fim){fim=true;pronto();}};setTimeout(ok,2500);
try{if(window.caches&&caches.keys){caches.keys().then(function(n){return Promise.all(n.map(function(x){return caches.delete(x);}));}).then(ok,ok);}else{ok();}}catch(e){ok();}}
function resgatar(){if(agindo)return;agindo=true;var n=tentativas();
if(n>=LIMITE){aviso('O PicoOS n\\u00e3o conseguiu carregar','J\\u00e1 limpei e tentei abrir de novo duas vezes, e n\\u00e3o resolveu. <b style="color:#E6EDF6">Teus dados est\\u00e3o salvos</b> \\u2014 venda, compra e estoque ficam no servidor, n\\u00e3o neste aparelho.<br><br>Tira um print desta tela e me manda.',true);return;}
marcar(n+1);aviso('Arrumando o PicoOS\\u2026','Faltou um peda\\u00e7o do app neste aparelho. J\\u00e1 estou limpando e abrindo de novo.<br><br>N\\u00e3o perdeu nada \\u2014 teus dados est\\u00e3o no servidor.',false);
// A primeira tentativa e na hora. A segunda espera tres segundos: quando a
// culpa e do wi-fi do bar, recarregar no mesmo instante falha igual, e esses
// tres segundos sao a diferenca entre voltar sozinha e ficar com a tela parada.
var espera=n===0?250:3000;
setTimeout(function(){limpar(function(){try{location.reload();}catch(e){}});},espera);}
function faltouPedaco(m){m=String(m||'');return m.indexOf('ChunkLoadError')>=0||m.indexOf('Loading chunk')>=0||m.indexOf('Loading CSS chunk')>=0||m.indexOf('dynamically imported module')>=0||m.indexOf('Importing a module script failed')>=0||(m.indexOf('Unexpected token')>=0&&m.indexOf('<')>=0);}
window.addEventListener('error',function(ev){var a=ev&&ev.target;
if(a&&a.tagName&&(a.tagName==='SCRIPT'||a.tagName==='LINK')){if(String(a.src||a.href||'').indexOf('/_next/')>=0)resgatar();return;}
if(faltouPedaco(ev&&(ev.message||(ev.error&&ev.error.message))))resgatar();},true);
window.addEventListener('unhandledrejection',function(ev){var r=ev&&ev.reason;if(faltouPedaco(r&&(r.message||r)))resgatar();});})();`,
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
