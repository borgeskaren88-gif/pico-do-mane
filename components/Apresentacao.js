'use client';
import React from 'react';
import { C, pageBg, LogoMark } from './ui';

// O QUE VENDE O PICOOS NÃO É A LISTA DE TELAS.
//
// Todo sistema de bar tem estoque, comanda e relatório — essa lista não
// diferencia nada e o dono do outro bar já ouviu ela de três vendedores.
//
// O que o PicoOS tem e os outros não é o hábito de ABRIR A BOCA quando o
// número está errado. Um dia inteiro de trabalho foi só isso: a batata que
// custava R$ 2.484,36, o xarope que virou trinta garrafas, o fornecedor que
// parecia o mais barato por causa de uma vírgula. Todo sistema mostraria esses
// números calado. É isso que vai nesta página, com os casos reais.
//
// CONTATO fica aqui em cima, numa linha só: quando ela me passar o número do
// WhatsApp eu troco aqui e pronto. Não invento número de telefone numa página
// que vai pro ar — telefone errado numa página de venda manda o cliente dela
// pra casa de estranho.
const WHATSAPP = '';      // ex.: '5548999999999'
const EMAIL = '';         // ex.: 'karen@picoos.app'

const avisos = [
  {
    titulo: 'R$ 2.484,36 numa porção de batata',
    texto: 'A ficha pedia 400 g de um saco porcionado e o sistema entendeu 400 sacos. Qualquer programa mostraria esse custo caladinho, e o preço sairia calculado em cima dele. O PicoOS para e diz: isso não é prejuízo, é ficha errada.',
  },
  {
    titulo: 'O xarope que virou trinta garrafas',
    texto: 'Ficha pedindo 30 ml de um item cadastrado em garrafa, sem dizer que a garrafa tem 700 ml. Custo do drink: R$ 1.806. O PicoOS leu o tamanho no próprio nome do produto e ofereceu o conserto num toque. R$ 11,65.',
  },
  {
    titulo: 'O fornecedor "mais barato" que era o mais caro',
    texto: 'Galão de 3,5 kg digitado no teclado do iPad, que só tem ponto. Lido como 3.500, o preço por quilo saía mil vezes menor e aquele fornecedor liderava a lista pra sempre. O erro sempre apontava pro lado de "tá barato".',
  },
  {
    titulo: 'O óleo que não estava em ficha nenhuma',
    texto: 'Ninguém sabe dizer quantos ml de óleo tem numa porção de batata — a pergunta não tem resposta. O PicoOS conta as tuas vendas, olha tuas notas de compra de óleo, e responde sozinho.',
  },
];

const faz = [
  ['Comanda e cozinha', 'Garçom lança na mesa, a cozinha vê na hora, e o estoque baixa sozinho quando a comanda fecha.'],
  ['Estoque e ficha técnica', 'Compra em quilo e receita em grama? Ele converte. E avisa quando a conversão não é possível, em vez de chutar.'],
  ['CMV de verdade', 'Reconstruído pelas tuas notas de compra, não pelo custo que alguém digitou uma vez em 2023.'],
  ['Preço certo', 'Diz por quanto vender contando imposto, taxa da maquininha, margem e a tua despesa fixa dividida por unidade.'],
  ['Cotações', 'Compara fornecedor por preço por unidade — caixa de 12 a R$ 95 sai a R$ 7,92, e é assim que se compara.'],
  ['Teto do MEI', 'Avisa pelo ritmo do ano, antes de estourar, não em dezembro quando não dá mais pra fazer nada.'],
];

const S = {
  secao: { maxWidth: 880, margin: '0 auto', padding: '0 20px' },
  h2: { fontSize: 'clamp(21px, 4.4vw, 29px)', fontWeight: 900, lineHeight: 1.2, margin: '0 0 10px', letterSpacing: '-.02em' },
  p: { fontSize: 'clamp(14.5px, 2.6vw, 16px)', lineHeight: 1.65, color: 'var(--c-muted)', margin: 0 },
};

export default function Apresentacao() {
  const contato = WHATSAPP
    ? `https://wa.me/${WHATSAPP}`
    : (EMAIL ? `mailto:${EMAIL}` : null);

  return (
    <main style={{ minHeight: '100dvh', background: pageBg, color: 'var(--c-text)', paddingBottom: 64 }}>
      {/* TOPO */}
      <div style={{ ...S.secao, paddingTop: 34, paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 30 }}>
          <LogoMark size={36} radius={10} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-.01em' }}>PicoOS</div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.13em', color: 'var(--c-accent)' }}>CENTRAL DE GESTÃO</div>
          </div>
        </div>

        <h1 style={{ fontSize: 'clamp(28px, 7vw, 46px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-.03em', margin: '0 0 16px' }}>
          Todo sistema mostra teu custo.<br />
          <span style={{ color: 'var(--c-accent)' }}>Esse aqui avisa quando ele está errado.</span>
        </h1>
        <p style={{ ...S.p, fontSize: 'clamp(15px, 3vw, 18px)', maxWidth: 620 }}>
          O PicoOS nasceu dentro de um bar em Florianópolis, feito pra quem não é de número.
          Ele não te entrega uma planilha bonita — ele te cutuca quando a conta não fecha,
          e te mostra onde.
        </p>
      </div>

      {/* OS AVISOS — o coração da coisa */}
      <div style={{ ...S.secao, marginTop: 46 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.13em', color: 'var(--c-accent)', marginBottom: 9 }}>
          COISAS QUE ACONTECERAM DE VERDADE
        </div>
        <h2 style={S.h2}>Nenhuma delas é invenção de folheto</h2>
        <p style={{ ...S.p, marginBottom: 22, maxWidth: 620 }}>
          São quatro erros que estavam escondidos num bar que funciona bem, achados pelo próprio sistema.
          Em qualquer outro programa eles continuariam lá, calados, virando preço.
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          {avisos.map((a) => (
            <div key={a.titulo} style={{
              borderRadius: 14, padding: '15px 17px',
              background: 'var(--c-panel)', border: '1px solid var(--c-card-border)',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ color: 'var(--c-amber)', fontWeight: 900, fontSize: 15, flexShrink: 0 }} aria-hidden="true">!</span>
                <div style={{ fontSize: 'clamp(15px, 3vw, 17px)', fontWeight: 800, lineHeight: 1.3 }}>{a.titulo}</div>
              </div>
              <p style={{ ...S.p, fontSize: 'clamp(13.5px, 2.5vw, 15px)', paddingLeft: 20 }}>{a.texto}</p>
            </div>
          ))}
        </div>
      </div>

      {/* O QUE ELE FAZ */}
      <div style={{ ...S.secao, marginTop: 50 }}>
        <h2 style={S.h2}>E o resto ele faz também</h2>
        <p style={{ ...S.p, marginBottom: 20, maxWidth: 620 }}>
          O de sempre, que todo sistema promete. A diferença está em cima.
        </p>
        <div style={{ display: 'grid', gap: 11, gridTemplateColumns: 'repeat(auto-fit, minmax(255px, 1fr))' }}>
          {faz.map(([t, d]) => (
            <div key={t} style={{ borderRadius: 13, padding: '13px 15px', background: 'var(--c-panel2)', border: '1px solid var(--c-hair)' }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 4 }}>{t}</div>
              <p style={{ ...S.p, fontSize: 13 }}>{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SEM LOJA DE APP */}
      <div style={{ ...S.secao, marginTop: 50 }}>
        <div style={{ borderRadius: 16, padding: 'clamp(18px, 4vw, 26px)', background: 'var(--c-panel)', border: '1px solid var(--c-card-border)' }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(19px, 3.8vw, 24px)' }}>Não precisa baixar nada</h2>
          <p style={{ ...S.p, marginBottom: 14 }}>
            O PicoOS abre no navegador do teu celular, do tablet e do computador do balcão.
            Pra ficar com cara de app: <b style={{ color: 'var(--c-text)' }}>Compartilhar → Adicionar à Tela de Início</b>.
            Vira ícone, abre em tela cheia, e atualiza sozinho — tu nunca mais vê "nova versão disponível".
          </p>
          <p style={{ ...S.p, fontSize: 13.5 }}>
            Sem loja de aplicativo, sem espera, sem atualização pra fazer. Trinta segundos e está na mão da tua equipe.
          </p>
        </div>
      </div>

      {/* CHAMADA */}
      <div style={{ ...S.secao, marginTop: 50, textAlign: 'center' }}>
        <h2 style={S.h2}>Quer ver rodando?</h2>
        <p style={{ ...S.p, maxWidth: 480, margin: '0 auto 20px' }}>
          Me chama que eu te mostro com os números do teu bar, não com dados de mentira.
        </p>
        {contato ? (
          <a href={contato} style={{
            display: 'inline-block', textDecoration: 'none',
            background: 'var(--c-accent)', color: '#06101F',
            fontWeight: 900, fontSize: 15.5, padding: '13px 30px', borderRadius: 999,
          }}>Falar com a Karen</a>
        ) : (
          /* Sem número de verdade, botão nenhum. Telefone inventado numa página
             de venda manda o cliente dela pra casa de estranho. */
          <div style={{ fontSize: 13, color: 'var(--c-faint)' }}>
            (falta pôr o contato aqui)
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--c-faint)', marginTop: 30, lineHeight: 1.6 }}>
          PicoOS · feito no Pico do Mané, Florianópolis
        </div>
      </div>
    </main>
  );
}
