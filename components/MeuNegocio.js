'use client';
import React, { useState } from 'react';
import { C, Card, Btn, Field, TextInput, PageTitle, SecTitle } from './ui';
import { PADRAO, lerNegocio } from '../lib/negocio';

// ONDE CADA UM PÕE O NOME DO SEU NEGÓCIO.
//
// O nome do produto (PicoOS) é fixo — é a marca. O nome do negócio e os nomes
// dos acessos são de quem usa. Antes estavam escritos no código, o que fazia o
// app servir a uma pessoa só.
//
// Em branco também é resposta: o app usa palavras neutras ("a dona", "o
// negócio") e nunca mostra o nome de outra pessoa na tela.
export default function MeuNegocio({ negocio, onChange }) {
  const atual = lerNegocio({ negocio });
  const [f, setF] = useState(atual);
  const [salvo, setSalvo] = useState(false);
  const set = (campo) => (v) => { setF((x) => ({ ...x, [campo]: v })); setSalvo(false); };
  const setPapel = (campo) => (v) => { setF((x) => ({ ...x, papeis: { ...x.papeis, [campo]: v } })); setSalvo(false); };
  const salvar = () => { onChange(lerNegocio({ negocio: f })); setSalvo(true); };

  return (
    <div>
      <PageTitle sub="O nome que aparece nas telas e nos relatórios">Meu negócio</PageTitle>

      <Card style={{ marginBottom: 16 }}>
        <Field label="Nome do negócio">
          <TextInput value={f.nome} onChange={set('nome')} placeholder="ex: Pico do Mané" />
        </Field>
        <Field label="Cidade (opcional)">
          <TextInput value={f.cidade} onChange={set('cidade')} placeholder="ex: Florianópolis" />
        </Field>
        <Field label="Como te chamar">
          <TextInput value={f.dona} onChange={set('dona')} placeholder="ex: Karen" />
        </Field>
        <div style={{ fontSize: 12, color: C.faint, margin: '-6px 0 2px', lineHeight: 1.5 }}>
          É o nome do bom-dia no Dashboard e de quem assina o fechamento do caixa.
        </div>
      </Card>

      <SecTitle>Os acessos</SecTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
          Como cada entrada se chama na tela de login. Cada negócio tem os seus: um bar tem cozinha e
          atendimento; um salão tem recepção. Em branco, fica o nome comum da função.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Quem manda"><TextInput value={f.papeis.dona} onChange={setPapel('dona')} placeholder={f.dona || 'Dona'} /></Field>
          <Field label="Cozinha / produção"><TextInput value={f.papeis.cozinha} onChange={setPapel('cozinha')} placeholder="Cozinha" /></Field>
          <Field label="Atendimento"><TextInput value={f.papeis.garcom} onChange={setPapel('garcom')} placeholder="Atendimento" /></Field>
          <Field label="Reservas"><TextInput value={f.papeis.reservas} onChange={setPapel('reservas')} placeholder="Reservas" /></Field>
        </div>
        <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5 }}>
          Trocar o nome aqui <b>não</b> troca a senha de ninguém — é só o rótulo. As senhas ficam em
          Configurações → Acessos.
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Btn onClick={salvar}>Salvar</Btn>
        {salvo && <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>Salvo. O nome novo já aparece nas telas.</span>}
      </div>
    </div>
  );
}
