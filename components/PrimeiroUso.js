'use client';
import React, { useState } from 'react';
import { C, Card, Btn, Field, TextInput } from './ui';
import { lerNegocio } from '../lib/negocio';

// A PRIMEIRA VEZ QUE ALGUÉM ABRE O PicoOS.
//
// Até aqui, um app novo abria com o movimento do Pico do Mané dentro — o
// histórico de outra pessoa, de verdade. Agora abre vazio, e vazio é pior de
// outro jeito: uma tela de números zerados não diz o que fazer.
//
// Então o app pergunta o essencial (o nome do negócio e como chamar quem
// manda) e mostra, em três linhas, por onde começar. Aparece só enquanto o app
// está realmente novo: sem nenhum lançamento e sem nome configurado. Depois
// nunca mais.
export default function PrimeiroUso({ onSalvar, onIr }) {
  const [nome, setNome] = useState('');
  const [dona, setDona] = useState('');
  const pronto = nome.trim().length > 1;

  const comecar = () => {
    if (!pronto) return;
    onSalvar(lerNegocio({ negocio: { nome, dona, papeis: {} } }));
  };

  return (
    <Card style={{ marginBottom: 16, borderColor: C.accent }}>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Bem-vindo ao PicoOS</div>
      <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 18, lineHeight: 1.55 }}>
        Este app é teu e está vazio — nada aqui dentro é de mais ninguém. Começa dizendo de quem ele é.
      </div>

      <Field label="Nome do negócio">
        <TextInput value={nome} onChange={setNome} placeholder="ex: Boteco da Ana" />
      </Field>
      <Field label="Como te chamar (opcional)">
        <TextInput value={dona} onChange={setDona} placeholder="ex: Ana" />
      </Field>

      <Btn onClick={comecar} kind={pronto ? 'primary' : 'ghost'}>
        {pronto ? 'Começar' : 'Escreve o nome do negócio'}
      </Btn>

      <div style={{ borderTop: `1px solid ${C.hair}`, margin: '18px 0 12px' }} />
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, fontWeight: 700, marginBottom: 8 }}>
        Depois, por onde começar
      </div>
      {[
        ['abastecimento', '1. Cadastra o que tu compras', 'Abastecimento → Estoque. Pode ser só o que mais sai, dá pra ir aumentando.'],
        ['receitas', '2. Lança o caixa de um dia', 'Finanças → Receitas. Com um dia já dá pra ver o app funcionando.'],
        ['hoje', '3. Põe tua meta do mês', 'No Dashboard. Aí ele te diz todo dia quanto falta.'],
      ].map(([id, titulo, sub]) => (
        <button key={id} onClick={() => onIr(id)}
          style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, marginBottom: 7,
            background: C.panel2, border: `1px solid ${C.line}`, color: C.text, cursor: 'pointer',
          }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{titulo}</span>
          <span style={{ display: 'block', fontSize: 12, color: C.faint, marginTop: 2, lineHeight: 1.45 }}>{sub}</span>
        </button>
      ))}
      <div style={{ fontSize: 12, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
        As senhas de cada acesso ficam em <b>Configurações → Acessos</b>. O nome do negócio e dos
        acessos, em <b>Configurações → Meu negócio</b>.
      </div>
    </Card>
  );
}
