'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C, Card, Field, inputStyle } from './ui';

export default function LoginForm() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      const json = await res.json();
      if (json.ok) {
        router.refresh();
      } else {
        setErro(json.erro || 'Senha incorreta.');
      }
    } catch {
      setErro('Não consegui conectar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.ink, color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#06101F', fontSize: 22, margin: '0 auto 14px' }}>PM</div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '.02em' }}>PICO DO MANÉ</div>
          <div style={{ fontSize: 12, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>Central de Gestão</div>
        </div>

        <Card>
          <form onSubmit={entrar}>
            <Field label="Senha">
              <div style={{ position: 'relative' }}>
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  placeholder="••••••••••"
                  onChange={(e) => setSenha(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="current-password"
                  spellCheck="false"
                  autoFocus
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button type="button" onClick={() => setMostrarSenha((v) => !v)}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: 8 }}>
                  {mostrarSenha ? 'ocultar' : 'ver'}
                </button>
              </div>
            </Field>
            {erro && <div style={{ color: C.red, fontSize: 13, marginBottom: 14, marginTop: -6 }}>{erro}</div>}
            <button type="submit" disabled={carregando} style={{ width: '100%', background: C.accent, color: '#06101F', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 15, fontWeight: 700, cursor: carregando ? 'default' : 'pointer', opacity: carregando ? 0.7 : 1 }}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </Card>
        <div style={{ textAlign: 'center', fontSize: 12, color: C.faint, marginTop: 16, lineHeight: 1.5 }}>
          Acesso restrito à gestão do Pico do Mané.
        </div>
      </div>
    </div>
  );
}
