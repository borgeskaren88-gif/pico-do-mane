'use client';
import { useEffect, useState } from 'react';
import { limparCopiaGuardada } from '../lib/versao';

// O QUE APARECE QUANDO O APP QUEBRA.
//
// Antes aparecia isto, em inglês, e mais nada:
//
//     Application error: a client-side exception has occurred
//     (see the browser console for more information)
//
// "Veja o console do navegador" é conselho pra programador. Pra quem está no bar
// às sete da noite com o caixa aberto é uma parede: ela não tem console, não tem
// como ter, e o app inteiro sumiu da tela.
//
// Esta tela faz três coisas que aquela não fazia.
//
//   1. TENTA CONSERTAR SOZINHA, uma vez só. A causa mais comum dessa queda não é
//      conta errada: é pedaço de programa que não chegou. O app fica guardado no
//      aparelho — é isso que faz ele abrir rápido e aguentar internet ruim — e
//      quando sai versão nova o aparelho às vezes fica com metade velha e metade
//      nova. Limpar o guardado e abrir de novo resolve. É o que ela faria se
//      soubesse que dá, o que ninguém tem por que saber.
//
//   2. DIZ O QUE QUEBROU, em texto grande o bastante pra sair legível numa foto.
//      Erro sem mensagem não é erro, é mistério — e mistério me obriga a
//      adivinhar em vez de consertar.
//
//   3. DÁ UM BOTÃO. Sempre. Mesmo num defeito que esta tela não sabe resolver,
//      ela sai daqui num toque.
//
// Nada aqui apaga dado nenhum: venda, compra e estoque moram no servidor. O que
// se limpa é só a cópia dos arquivos do app guardada neste aparelho.

const MARCA = 'picoos:ja-tentei-limpar';

export default function TelaQuebrou({ error, reset, ondeEstava }) {
  // Começa ligado porque a primeira coisa que esta tela faz é tentar se
  // consertar. Se a limpeza já foi tentada nesta sessão, aí sim ela aparece de
  // verdade — senão viraria um vai-e-volta infinito de recarregar.
  const [tentando, setTentando] = useState(true);
  const [limpando, setLimpando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let jaTentou = true;
    try { jaTentou = sessionStorage.getItem(MARCA) === '1'; } catch { jaTentou = true; }
    if (jaTentou) { setTentando(false); return; }
    try { sessionStorage.setItem(MARCA, '1'); } catch { /* ignora */ }
    (async () => {
      await limparCopiaGuardada();
      try { window.location.reload(); } catch { setTentando(false); }
    })();
  }, []);

  const texto = [
    error?.name && error.name !== 'Error' ? error.name : '',
    error?.message || 'erro sem mensagem',
    error?.digest ? `digest ${error.digest}` : '',
    ondeEstava || (typeof window !== 'undefined' ? window.location.pathname : ''),
  ].filter(Boolean).join(' — ');

  const limparAgora = async () => {
    setLimpando(true);
    await limparCopiaGuardada();
    try { sessionStorage.removeItem(MARCA); } catch { /* ignora */ }
    try { window.location.reload(); } catch { setLimpando(false); }
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { /* ignora */ }
  };

  if (tentando) {
    // É esta que ela vai ver em quase todos os casos, por dois segundos, antes
    // de o app voltar sozinho.
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '100px 20px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Arrumando o PicoOS…</div>
        <div style={{ fontSize: 14, color: '#9FB0C6', lineHeight: 1.6 }}>
          Um pedaço do app não chegou direito no aparelho. Já estou limpando e abrindo de novo.
          <br />Não perdeu nada — teus dados estão no servidor.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>O PicoOS travou aqui</div>
      <div style={{ fontSize: 14.5, color: '#9FB0C6', lineHeight: 1.6, marginBottom: 18 }}>
        Já tentei limpar e abrir de novo e não resolveu. <b style={{ color: '#E6EDF6' }}>Nenhum dado teu se perdeu</b> —
        venda, compra e estoque ficam no servidor, não neste aparelho.
      </div>

      <div style={{ background: '#0D1420', border: '1px solid #1E2A3C', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ fontSize: 11.5, color: '#6F8099', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800, marginBottom: 6 }}>
          Manda isto pra mim
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#E6EDF6', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {texto}
        </div>
        <button type="button" onClick={copiar}
          style={{ marginTop: 10, background: 'transparent', border: '1px solid #1E2A3C', color: '#4FC3F7', borderRadius: 999, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          {copiado ? 'Copiado' : 'Copiar o erro'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={limparAgora} disabled={limpando}
          style={{ background: '#4FC3F7', border: 'none', color: '#06101F', borderRadius: 10, padding: '12px 20px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          {limpando ? 'Limpando…' : 'Limpar e abrir de novo'}
        </button>
        {/* `reset` tenta desenhar a tela outra vez sem recarregar nada. Às vezes
            basta, e é o caminho mais curto de volta ao trabalho. */}
        <button type="button" onClick={() => { try { reset && reset(); } catch { window.location.reload(); } }}
          style={{ background: 'transparent', border: '1px solid #1E2A3C', color: '#E6EDF6', borderRadius: 10, padding: '12px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Tentar de novo
        </button>
      </div>

      <div style={{ fontSize: 12.5, color: '#6F8099', lineHeight: 1.6, marginTop: 20 }}>
        Se voltar a travar, tira o print desta tela e me manda. Com o texto aí de cima eu acho o defeito direto,
        sem ter que adivinhar.
      </div>
    </div>
  );
}
