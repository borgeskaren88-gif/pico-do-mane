'use client';
import React, { useEffect, useState } from 'react';
import { C } from './ui';

// Mostra qual versão do PicoOS está rodando aqui. Serve pra saber, num olhar,
// se o aparelho já pegou a atualização mais nova ou ficou numa antiga.
export default function VersaoApp() {
  const [v, setV] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/versao', { cache: 'no-store' });
        const j = await r.json();
        if (vivo && j && j.v) setV(String(j.v).slice(0, 7));
      } catch { /* sem internet: não mostra nada */ }
    })();
    return () => { vivo = false; };
  }, []);

  if (!v) return null;
  return (
    <div style={{ fontSize: 10, color: C.faint, textAlign: 'center', padding: '0 12px 10px', letterSpacing: '.04em' }}>
      versão {v}
    </div>
  );
}
