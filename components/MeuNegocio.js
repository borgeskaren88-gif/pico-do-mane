'use client';
import React, { useState, useRef } from 'react';
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

  // A FOTO ENCOLHE ANTES DE SAIR DO APARELHO.
  //
  // Foto de celular tem 3 a 5 MB. Ela mora dentro do painel, que é lido
  // inteiro toda vez que o app abre — no 4G do bar, no iPad do balcão, no
  // celular da cozinha. Mandar a original faria cada abertura do sistema
  // arrastar megabytes pra mostrar um círculo de 40 pixels.
  //
  // Então o recorte e a compressão acontecem AQUI, antes de subir: quadrado
  // de 160px pelo meio da imagem, JPEG, uns 8 KB. O servidor ainda tem um
  // teto próprio — cinto e suspensório, porque este caminho é o único hoje
  // mas pode não ser o único amanhã.
  const arquivoRef = useRef(null);
  const [erroFoto, setErroFoto] = useState('');
  const escolherFoto = (file) => {
    setErroFoto('');
    if (!file) return;
    if (!/^image\//.test(file.type || '')) { setErroFoto('Isso não é uma imagem.'); return; }
    const leitor = new FileReader();
    leitor.onerror = () => setErroFoto('Não consegui ler esse arquivo.');
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => setErroFoto('Não consegui abrir essa imagem.');
      img.onload = () => {
        try {
          const L = 160;
          // Quadrado pelo MEIO: foto de retrato cortada pelo topo decepa a
          // cabeça, e é sempre a cabeça que importa num avatar.
          const lado = Math.min(img.width, img.height);
          const sx = (img.width - lado) / 2;
          const sy = (img.height - lado) / 2;
          const cv = document.createElement('canvas');
          cv.width = L; cv.height = L;
          const ctx = cv.getContext('2d');
          ctx.drawImage(img, sx, sy, lado, lado, 0, 0, L, L);
          const dataUrl = cv.toDataURL('image/jpeg', 0.72);
          setF((x) => ({ ...x, fotoDona: dataUrl }));
          setSalvo(false);
        } catch { setErroFoto('Não consegui preparar essa imagem.'); }
      };
      img.src = String(leitor.result || '');
    };
    leitor.readAsDataURL(file);
  };

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

        {/* A FOTO. Fica junto do nome porque é a mesma coisa: como tu aparece
            na tela. E a nota diz onde ela NÃO aparece, que foi a escolha dela
            quando eu perguntei. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <div style={{
            width: 62, height: 62, borderRadius: 999, flexShrink: 0, overflow: 'hidden',
            background: C.panel2, border: `1px solid ${C.line}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {f.fotoDona
              ? <img src={f.fotoDona} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 22, fontWeight: 900, color: C.faint }}>{(f.dona || '?').trim().charAt(0).toUpperCase()}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn small kind="ghost" onClick={() => arquivoRef.current && arquivoRef.current.click()}>
                {f.fotoDona ? 'Trocar foto' : 'Pôr uma foto'}
              </Btn>
              {f.fotoDona && (
                <Btn small kind="ghost" onClick={() => { setF((x) => ({ ...x, fotoDona: '' })); setSalvo(false); }}>Tirar</Btn>
              )}
            </div>
            <input ref={arquivoRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { escolherFoto(e.target.files && e.target.files[0]); e.target.value = ''; }} />
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
              Aparece no bom-dia do Dashboard. <b style={{ color: C.muted }}>Não</b> vai pra tela de entrada —
              aquela é aberta, e quem abrisse o endereço veria sem precisar de senha.
            </div>
            {erroFoto && <div style={{ fontSize: 12, color: C.red, marginTop: 5 }}>{erroFoto}</div>}
          </div>
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
