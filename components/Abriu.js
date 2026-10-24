'use client';
import { useEffect } from 'react';

// TIRA A TELA DE "ABRINDO" ASSIM QUE O APP EXISTE.
//
// A tela de abertura mora no HTML (ver app/layout.js), onde não depende de
// baixar nada. Quem apaga ela é este componente, e ele só roda quando o React
// montou de verdade — ou seja, quando o app está realmente de pé.
//
// Checar "o script carregou" não serviria: o arquivo pode chegar e o app
// quebrar na primeira linha. Montar é a única prova que vale.
export default function Abriu() {
  useEffect(() => {
    try {
      const el = document.getElementById('picoos-abrindo');
      if (el && el.parentNode) el.parentNode.removeChild(el);
      // Avisa o script da página pra ele parar de contar o tempo — senão,
      // num aparelho lento, o "está demorando" apareceria por cima do app já
      // aberto.
      window.__picoosAbriu = true;
    } catch { /* se não deu, a tela de abertura some no próximo carregamento */ }
  }, []);
  return null;
}
