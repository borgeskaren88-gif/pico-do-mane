'use client';
import React from 'react';
import { C, Btn } from './ui';

// AS COISAS DE AJUSTE, FORA DO CAMINHO DO TRABALHO.
//
// Backup, Acessos e Notificações estavam no meio do menu, junto com as telas
// que ela usa todo dia. São telas de ajustar o sistema, não de tocar o bar:
// ela mexe uma vez e não volta mais. Ficavam empurrando Pasta e Marketing pra
// baixo e alongando a lista à toa.
//
// Agora moram atrás da engrenagem, junto com tema e cor — que é onde quem usa
// qualquer aplicativo procura.

export const CORES = [
  { id: '', nome: 'Azul', amostra: '#3B86F5' },
  { id: 'verde', nome: 'Verde', amostra: '#1FB562' },
  { id: 'turquesa', nome: 'Turquesa', amostra: '#14B8C4' },
  { id: 'roxo', nome: 'Roxo', amostra: '#8B5CF6' },
  { id: 'rosa', nome: 'Rosa', amostra: '#EC4899' },
  { id: 'laranja', nome: 'Laranja', amostra: '#F59331' },
];

const ATALHOS = [
  ['guia', 'Como usar', 'O primeiro mês, em ordem — e o que já está feito'],
  ['negocio', 'Meu negócio', 'O nome que aparece nas telas'],
  ['backup', 'Backup e relatório', 'Baixar tudo o que está guardado'],
  ['acessos', 'Acessos', 'Senhas e quem pode entrar'],
  ['notificacoes', 'Notificações', 'Os avisos que chegam no celular'],
  ['widget', 'Widget', 'O quadrinho na tela do iPad'],
];

export default function Config({ aberto, onFechar, tema, onTema, cor, onCor, onIr, modulos, onModulos, recursos }) {
  if (!aberto) return null;
  const ir = (id) => { onIr(id); onFechar(); };

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(4, 9, 18, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="Configurações"
        style={{
          width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto',
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,.35)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 19, fontWeight: 900 }}>Configurações</div>
          <button onClick={onFechar} aria-label="Fechar"
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>×</button>
        </div>

        {/* TEMA */}
        <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Tema</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {[['claro', 'Claro'], ['escuro', 'Escuro']].map(([id, nome]) => (
            <button key={id} onClick={() => onTema(id)} aria-pressed={tema === id}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 800,
                background: tema === id ? C.accent : 'transparent', color: tema === id ? '#06101F' : C.text,
                border: `1px solid ${tema === id ? C.accent : C.line}`,
              }}>{nome}</button>
          ))}
        </div>

        {/* COR */}
        <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 3 }}>Cor do app</div>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 10, lineHeight: 1.45 }}>
          Muda os botões e os destaques. O verde de lucro e o vermelho de prejuízo não mudam — eles
          querem dizer uma coisa, não são enfeite.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
          {CORES.map((c) => {
            const on = (cor || '') === c.id;
            return (
              <button key={c.id || 'azul'} onClick={() => onCor(c.id)} aria-pressed={on} title={c.nome}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 11, cursor: 'pointer',
                  background: on ? C.panel2 : 'transparent', border: `1px solid ${on ? C.accent : C.line}`,
                  color: C.text, fontSize: 13, fontWeight: on ? 800 : 600,
                }}>
                <i style={{ width: 16, height: 16, borderRadius: 999, background: c.amostra, flexShrink: 0, boxShadow: on ? `0 0 0 2px ${C.panel}, 0 0 0 3.5px ${c.amostra}` : 'none' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
              </button>
            );
          })}
        </div>

        {/* O QUE ESTE NEGÓCIO USA.
            O Darci custa dinheiro por pergunta e precisa de chave de IA no
            servidor. Sem chave, nem adianta ligar — e a tela diz isso em vez
            de deixar um interruptor que não faz nada. */}
        <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>O que eu uso</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 13px', borderRadius: 11, background: C.panel2, border: `1px solid ${C.line}`, marginBottom: 18 }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Darci, teu sócio</span>
            <span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 1, lineHeight: 1.45 }}>
              {recursos && recursos.darci === false
                ? 'Esta instalação não tem chave de IA — o Darci não responderia.'
                : (modulos && modulos.darci === false)
                  ? 'Desligado. Liga aqui se quiseres usar — cada pergunta consome a chave de IA.'
                  : 'Responde sobre o negócio. Cada pergunta consome a chave de IA.'}
            </span>
          </span>
          <button
            onClick={() => onModulos && onModulos({ ...(modulos || {}), darci: !(modulos && modulos.darci !== false) })}
            disabled={!!(recursos && recursos.darci === false)}
            aria-pressed={!!(modulos && modulos.darci !== false)}
            style={{
              flexShrink: 0, border: 'none', borderRadius: 999, width: 50, height: 28, position: 'relative',
              cursor: recursos && recursos.darci === false ? 'not-allowed' : 'pointer',
              opacity: recursos && recursos.darci === false ? 0.4 : 1,
              background: (modulos && modulos.darci !== false) ? C.accent : C.line,
            }}>
            <i style={{
              position: 'absolute', top: 3, left: (modulos && modulos.darci !== false) ? 25 : 3,
              width: 22, height: 22, borderRadius: 999, background: '#fff', transition: 'left .15s',
            }} />
          </button>
        </div>

        {/* ATALHOS */}
        <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>Ajustes do sistema</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {ATALHOS.map(([id, nome, sub]) => (
            <button key={id} onClick={() => ir(id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                width: '100%', textAlign: 'left', padding: '11px 13px', borderRadius: 11, cursor: 'pointer',
                background: C.panel2, border: `1px solid ${C.line}`, color: C.text,
              }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{nome}</span>
                <span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 1 }}>{sub}</span>
              </span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={C.faint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" /></svg>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 18 }}>
          <Btn kind="ghost" onClick={onFechar}>Fechar</Btn>
        </div>
      </div>
    </div>
  );
}
