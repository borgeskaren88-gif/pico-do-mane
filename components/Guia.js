'use client';
import React, { useState } from 'react';
import { C, Card, Btn, PageTitle, SecTitle } from './ui';

// O GUIA, DENTRO DO PRÓPRIO APP.
//
// Existe um guia em PDF pra entregar na mão. Este aqui é outra coisa, e de
// propósito:
//
//   - o PDF MOSTRA foto da tela; aqui o botão LEVA até ela;
//   - o PDF é igual pra todo mundo; aqui ele sabe o que já foi feito e aponta
//     o próximo passo;
//   - o PDF congela no dia em que foi gerado; este anda junto com o app.
//
// Por isso ele não repete o PDF: é o mesmo caminho, só que vivo.

// Um passo: o que fazer, por que importa, e como saber que já está feito.
// `pronto` é calculado do estado REAL do negócio — não é uma caixinha que a
// pessoa marca e esquece.
function Passo({ n, titulo, porque, onde, ir, pronto, destaque }) {
  return (
    <Card style={{
      marginBottom: 10, padding: '14px 16px',
      borderColor: pronto ? `${C.green}55` : destaque ? C.accent : C.line,
      background: destaque ? C.raised : undefined,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center',
          fontSize: 13, fontWeight: 800, marginTop: 1,
          background: pronto ? C.green : 'transparent',
          border: pronto ? 'none' : `1.5px solid ${destaque ? C.accent : C.line}`,
          color: pronto ? '#052014' : destaque ? C.accent : C.faint,
        }}>{pronto ? '✓' : n}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.35, color: pronto ? C.muted : C.text }}>
            {titulo}
          </div>
          <div style={{ fontSize: 13, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>{porque}</div>
          {!pronto && (
            <div style={{ marginTop: 10 }}>
              <Btn small kind={destaque ? 'primary' : 'ghost'} onClick={ir}>{onde}</Btn>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Duvida({ pergunta, children }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div style={{ borderTop: `1px solid ${C.hair}` }}>
      <button onClick={() => setAberta((v) => !v)} style={{
        width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
        padding: '12px 0', color: C.text, fontSize: 14.5, fontWeight: 700, display: 'flex', gap: 10, alignItems: 'baseline',
      }}>
        <span style={{ color: C.accent, flexShrink: 0 }}>{aberta ? '−' : '+'}</span>
        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>{pergunta}</span>
      </button>
      {aberta && <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, padding: '0 0 14px 24px' }}>{children}</div>}
    </div>
  );
}

export default function Guia({
  onIr, nome = '', receitas = [], estoque = [], compras = [], fichas = [],
  temMeta = false, senhasDeFabrica = [], temComandas = true,
}) {
  const passos = [
    {
      titulo: 'Trocar as senhas da equipe',
      porque: 'Enquanto estiverem na senha de fábrica (1234), quem souber o endereço do app entra. Dez segundos cada.',
      onde: 'Abrir Acessos', ir: () => onIr('acessos'),
      pronto: senhasDeFabrica.length === 0,
    },
    {
      titulo: 'Lançar o caixa de um dia',
      porque: 'A data e quanto entrou. Um dia só já tira o app do zero — é daqui que sai todo o resto.',
      onde: 'Abrir Receitas', ir: () => onIr('receitas'),
      pronto: receitas.length > 0,
    },
    {
      titulo: 'Pôr a meta do mês',
      porque: 'O valor que tu queres faturar e em que dias o negócio abre. Aí o Dashboard te diz todo dia quanto falta e quanto precisa por noite.',
      onde: 'Abrir o Dashboard', ir: () => onIr('hoje'),
      pronto: temMeta,
    },
    {
      titulo: 'Cadastrar o que mais sai',
      porque: 'Começa com 15 ou 20 itens, não com 200. Põe o estoque mínimo em cada um: é ele que faz o app te avisar antes de faltar.',
      onde: 'Abrir Estoque', ir: () => onIr('estoque'),
      pronto: estoque.length >= 5,
    },
    {
      titulo: 'Registrar uma compra',
      porque: 'Uma nota só vira compra, despesa (ou conta a pagar) e saldo no estoque de uma vez. Depois de registrar, lê o que aparece escrito: ele diz o que entrou.',
      onde: 'Abrir Compras', ir: () => onIr('compras'),
      pronto: compras.length > 0,
    },
    {
      titulo: 'Montar a ficha dos que mais vendem',
      porque: 'O que vai dentro de cada prato. Só os cinco que mais saem — é onde está o teu dinheiro. Depois a tela de Margem te mostra quanto sobra em cada um.',
      onde: 'Abrir Fichas técnicas', ir: () => onIr('estoque'),
      pronto: fichas.length > 0,
    },
  ];

  const feitos = passos.filter((p) => p.pronto).length;
  const proximo = passos.findIndex((p) => !p.pronto);
  const tudoPronto = feitos === passos.length;

  return (
    <div>
      <PageTitle sub="O primeiro mês, em ordem — do que dá retorno primeiro ao que dá depois">
        Como usar
      </PageTitle>

      {/* Onde ela está, lido do movimento de verdade. */}
      <Card style={{ marginBottom: 16, borderColor: tudoPronto ? C.green : C.accent }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: tudoPronto ? C.green : C.text }}>
            {tudoPronto
              ? `${nome || 'O teu negócio'} está configurado`
              : `${feitos} de ${passos.length} passos feitos`}
          </div>
          <div style={{ fontSize: 13, color: C.faint, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round((feitos / passos.length) * 100)}%
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: C.panel2, border: `1px solid ${C.hair}`, overflow: 'hidden', margin: '10px 0 8px' }}>
          <i style={{ display: 'block', height: '100%', width: `${(feitos / passos.length) * 100}%`, background: tudoPronto ? C.green : C.accent, borderRadius: 999 }} />
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          {tudoPronto
            ? 'Daqui em diante é rotina: dois minutos por dia, dez por semana. Está logo abaixo.'
            : 'Não precisa fazer tudo hoje. Os três primeiros levam quinze minutos juntos.'}
        </div>
      </Card>

      {passos.map((p, i) => (
        <Passo key={p.titulo} n={i + 1} {...p} destaque={i === proximo} />
      ))}

      <SecTitle>A rotina, quando já estiver andando</SecTitle>
      <Card style={{ marginBottom: 16 }}>
        {[
          ['Todo dia · 2 min', 'Abrir o Dashboard e lançar o caixa do dia.'],
          ['Toda semana · 10 min', 'Estoque: o que está no mínimo. Contas a Pagar: o que vence.'],
          ['Todo mês · 20 min', 'Relatórios: o fechamento. Margem: os preços ainda fazem sentido? Backup: baixar e guardar.'],
        ].map(([quando, o_que]) => (
          <div key={quando} style={{ padding: '9px 0', borderTop: `1px solid ${C.hair}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.accent, letterSpacing: '.03em' }}>{quando}</div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{o_que}</div>
          </div>
        ))}
      </Card>

      <SecTitle>Quando não sair como tu esperavas</SecTitle>
      <Card style={{ marginBottom: 16, paddingTop: 2 }}>
        <Duvida pergunta="Registrei a compra e o estoque não mudou">
          O produto da nota não bateu com nenhum item cadastrado. Em <b>Abastecimento → Compras</b>,
          procura o aviso amarelo “não somou saldo” e usa o botão <b>Entrar no estoque</b> na linha.
          Se o produto ainda não existe, cadastra ele primeiro em Estoque.
        </Duvida>
        {temComandas && (
          <Duvida pergunta="Não consigo fechar a mesa">
            Falta dizer quantas pessoas estavam nela. O botão fica apagado de propósito até alguém
            contar — é a informação que não dá pra recuperar depois.
          </Duvida>
        )}
        <Duvida pergunta="Lancei uma compra a prazo e ela não apareceu em Despesas">
          Está certo. Boleto vai pra <b>Contas a Pagar</b> e só vira despesa quando tu marcares
          como pago.
        </Duvida>
        <Duvida pergunta="Registrei uma compra e a internet caiu no meio">
          A nota fica guardada no teu aparelho, inteira. Abre Compras de novo: ela está lá, com um
          aviso. Toca em <b>Registrar compra</b> e pronto — não precisa digitar tudo outra vez.
        </Duvida>
        <Duvida pergunta="Esqueci a senha de alguém da equipe">
          Em <b>Configurações → Acessos</b> dá pra trocar a senha de cada acesso, e também cortar
          quem já está dentro — o que importa quando alguém sai do time.
        </Duvida>
        <Duvida pergunta="A tela ficou preta ou deu erro">
          Fecha e abre o app. Se continuar, tira um print da tela e manda pra quem te instalou — o
          print diz o motivo.
        </Duvida>
      </Card>

      <SecTitle>O que o PicoOS não faz</SecTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
          Melhor saber agora do que descobrir no meio do mês:
          <ul style={{ margin: '8px 0 10px', paddingLeft: 18 }}>
            <li><b style={{ color: C.text }}>Não emite nota fiscal</b> nem cupom fiscal</li>
            <li><b style={{ color: C.text }}>Não lê código de barras</b> — não é caixa de supermercado</li>
            <li><b style={{ color: C.text }}>Não liga no iFood</b> nem em máquina de cartão</li>
            <li><b style={{ color: C.text }}>Não calcula encargos</b> — o Ponto conta as horas e diz quanto pagar, mas não faz INSS, FGTS nem gera guia</li>
          </ul>
          Pra isso tu continuas com o que já usas. O PicoOS é pra saber se o negócio está dando
          dinheiro — que é a conta que esses outros não te dão.
        </div>
      </Card>

      <Card style={{ borderColor: `${C.green}55` }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Os teus dados são teus</div>
        <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, marginBottom: 12 }}>
          O Backup baixa tudo o que está guardado, num arquivo só, a qualquer momento, sem pedir
          pra ninguém. Faz uma vez por mês.
        </div>
        <Btn small kind="ghost" onClick={() => onIr('backup')}>Abrir Backup</Btn>
      </Card>

      <div style={{ fontSize: 13, color: C.faint, lineHeight: 1.6, margin: '20px 0 8px', textAlign: 'center' }}>
        Se tu só fizeres uma coisa: lança o caixa todo dia e põe a meta do mês.<br />
        São dois minutos por dia, e te dizem no dia 10 se o mês vai fechar bem — enquanto ainda dá
        tempo de fazer alguma coisa.
      </div>
    </div>
  );
}
