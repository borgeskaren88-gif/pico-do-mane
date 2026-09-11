'use client';
import React from 'react';
import { C } from './ui';

// O esqueleto do PicoOS: lateral com o menu no computador, e no celular ela
// vira uma gaveta que abre pelo botão de três risquinhos.
//
// Fica num arquivo só porque mais de uma tela usa (o painel da Karen e a tela
// da Mari) — assim as duas têm exatamente a mesma cara, e um ajuste aqui vale
// pras duas.
export default function EstiloShell() {
  return (
    <style>{`
.pos-shell{display:flex;align-items:stretch;min-height:100vh}
.pos-sidebar{width:236px;flex-shrink:0;box-sizing:border-box;display:flex;flex-direction:column;background:${C.panel};border-right:1px solid ${C.hair};position:sticky;top:0;height:100vh}
.pos-side-head{display:flex;align-items:center;gap:10px;padding:calc(16px + env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid ${C.hair}}
.pos-nav{flex:1;overflow-y:auto;padding:12px 10px}
.pos-group{margin-bottom:12px}
.pos-group-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:${C.faint};font-weight:800;padding:4px 10px 6px}
.pos-navitem{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;border:none;background:transparent;color:${C.muted};border-radius:10px;padding:10px 12px;font-size:14px;font-weight:700;cursor:pointer;text-align:left;margin-bottom:2px}
.pos-navitem:hover{background:${C.panel2};color:${C.text}}
.pos-navitem.pos-active{background:${C.accent};color:#06101F}
.pos-badge{background:${C.red};color:#fff;font-size:11px;font-weight:800;min-width:18px;height:18px;border-radius:999px;padding:0 5px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-navitem.pos-active .pos-badge{background:#06101F}
.pos-side-foot{border-top:1px solid ${C.hair};padding:12px;display:flex;align-items:center;gap:8px}
.pos-content{flex:1;min-width:0}
.pos-shell:not(.pos-recolhida) .pos-content{padding-top:env(safe-area-inset-top)}
.pos-topbar{display:none}
.pos-overlay{display:none}
.pos-shell.pos-recolhida .pos-sidebar{display:none}
.pos-shell.pos-recolhida .pos-topbar{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 16px 12px;border-bottom:1px solid ${C.hair};position:sticky;top:0;background:${C.barBg};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:10}
.pos-recolher{background:transparent;border:none;color:${C.faint};border-radius:8px;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pos-recolher:hover{background:${C.panel2};color:${C.text}}
.pos-burger{background:transparent;border:1px solid ${C.line};color:${C.text};border-radius:10px;width:42px;height:42px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
@media (max-width:819px){
.pos-sidebar{position:fixed;top:0;left:0;z-index:60;transform:translateX(-100%);transition:transform .22s ease;box-shadow:0 0 40px rgba(0,0,0,.4)}
.pos-sidebar.pos-open{transform:translateX(0)}
.pos-shell.pos-recolhida .pos-sidebar{display:flex}
.pos-shell:not(.pos-recolhida) .pos-content{padding-top:0}
.pos-recolher{display:none}
.pos-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:55}
.pos-topbar{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 16px 12px;border-bottom:1px solid ${C.hair};position:sticky;top:0;background:${C.barBg};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:10}
}
`}</style>
  );
}
