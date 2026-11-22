'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { C, Card, Btn, Field, TextInput } from './ui';

// A ASSINATURA DO BAR, pra dona de um bar que se cadastrou sozinho.
//
// Mostra em que pé está (teste, em dia, atrasado), e os três botões que ela
// precisa: assinar, pagar a mensalidade em aberto e cancelar. O pagamento
// acontece na página do Asaas (Pix, boleto ou cartão) — o app só pega o link.
//
// O link abre por um BOTÃO-LINK de verdade, não por window.open: no app
// instalado do iPhone, abrir janela por código é bloqueado calado.
//
// O bar isento (o Pico do Mané) não vê nada disto.

const reais = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

export function useAssinatura() {
  const [s, setS] = useState(null);
  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/assinatura', { cache: 'no-store' });
      const j = await r.json();
      if (j && j.ok) setS(j);
    } catch { /* sem rede: não mostra nada */ }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  return [s, carregar];
}

// A faixa no alto do app: "faltam 9 dias do teste". Só aparece no teste, no
// atraso, e nos últimos 5 dias de um mês pago com a assinatura cancelada.
export function AvisoAssinatura({ s, onAbrir }) {
  if (!s || !s.estado || s.estado === 'isento') return null;
  let txt = null;
  let cor = C.accent;
  if (s.estado === 'teste') txt = s.dias <= 1 ? 'Teu teste grátis acaba hoje.' : `Faltam ${s.dias} dias do teu teste grátis.`;
  if (s.estado === 'atrasado') { txt = `A mensalidade venceu. O app fecha em ${s.dias} ${s.dias === 1 ? 'dia' : 'dias'} se não for paga.`; cor = C.red; }
  if (s.estado === 'em_dia' && s.cancelada && s.dias <= 5) txt = `Assinatura cancelada: o app fecha em ${s.dias} ${s.dias === 1 ? 'dia' : 'dias'}.`;
  if (!txt) return null;
  return (
    <div data-aviso-assinatura style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: `1px solid ${cor}`, background: C.panel2, borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ flex: 1, minWidth: 180, fontSize: 14, fontWeight: 700, color: cor === C.red ? C.red : C.text }}>{txt}</div>
      <Btn small onClick={onAbrir}>{s.estado === 'teste' && !s.assinou ? 'Assinar' : 'Ver assinatura'}</Btn>
    </div>
  );
}

export default function Assinatura() {
  const [s, recarregar] = useAssinatura();
  const [doc, setDoc] = useState('');
  const [nome, setNome] = useState('');
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  useEffect(() => { if (s && s.nomeContato && !nome) setNome(s.nomeContato); }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <Card><div style={{ color: C.muted, fontSize: 14 }}>Carregando a assinatura…</div></Card>;
  if (s.estado === 'isento') {
    return <Card><div style={{ fontSize: 14, color: C.muted }}>Este negócio não tem mensalidade.</div></Card>;
  }

  const agir = async (corpo) => {
    setErro(''); setMsg(''); setLink(''); setIndo(true);
    try {
      const r = await fetch('/api/assinatura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { setErro(j.erro || 'Não deu certo. Tenta de novo.'); return; }
      if (j.link) setLink(j.link);
      if (j.jaPago) setMsg(j.proxima ? `Está tudo pago. A próxima mensalidade vence em ${dataBR(j.proxima + 'T12:00:00')}.` : 'Não tem nenhuma mensalidade em aberto. Está tudo pago.');
      if (corpo.acao === 'cancelar') setMsg(`Assinatura cancelada. O app continua aberto até ${dataBR(j.ate)}, e teus dados ficam guardados.`);
      recarregar();
    } catch { setErro('Sem conexão. Tenta de novo.'); } finally { setIndo(false); setConfirmarCancelar(false); }
  };

  const titulo = {
    teste: `Teste grátis: ${s.dias} ${s.dias === 1 ? 'dia' : 'dias'} restantes`,
    em_dia: 'Assinatura em dia',
    atrasado: 'Mensalidade atrasada',
    bloqueado: 'O app está pausado',
  }[s.estado] || 'Assinatura';

  return (
    <div data-assinatura>
      <Card style={{ marginBottom: 14, borderColor: s.estado === 'atrasado' || s.estado === 'bloqueado' ? C.red : C.line }}>
        <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 6 }}>{titulo}</div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
          {s.estado === 'teste' && <>Usa tudo à vontade até <b>{dataBR(s.liberadoAte)}</b>. Depois, o PicoOS custa <b>{reais(s.preco)} por mês</b>. Se assinares agora, o mês pago começa a contar só quando o teste acabar.</>}
          {s.estado === 'em_dia' && <>Liberado até <b>{dataBR(s.liberadoAte)}</b>.{s.cancelada ? ' A assinatura foi cancelada: depois dessa data o app pausa.' : ' A próxima mensalidade chega pelo e-mail/SMS, com o link do Asaas.'}</>}
          {s.estado === 'atrasado' && <>A mensalidade venceu em <b>{dataBR(s.liberadoAte)}</b>. O app continua funcionando por mais <b>{s.dias} {s.dias === 1 ? 'dia' : 'dias'}</b>; depois pausa até o pagamento.</>}
          {s.estado === 'bloqueado' && <>O teste ou a mensalidade venceu. <b>Nada foi apagado</b>: pagou, o app volta na hora do jeito que estava.</>}
        </div>
      </Card>

      {!s.pagamentoLigado ? (
        <Card>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
            O pagamento pelo app ainda não está ligado. Fala com a gente que a gente resolve na hora.
          </div>
          <Btn href={`https://wa.me/${s.whatsapp}?text=${encodeURIComponent('Oi! Quero assinar o PicoOS.')}`} target="_blank" rel="noopener noreferrer">Falar no WhatsApp</Btn>
        </Card>
      ) : (
        <Card>
          {!s.assinou ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Assinar por {reais(s.preco)}/mês</div>
              <div style={{ fontSize: 13, color: C.faint, marginBottom: 14, lineHeight: 1.5 }}>
                Pix, boleto ou cartão: escolhes na página do pagamento. Cancela quando quiser, aqui mesmo.
              </div>
              <Field label="Nome que vai na cobrança"><TextInput value={nome} onChange={setNome} placeholder="teu nome ou o nome da empresa" /></Field>
              <Field label="CPF ou CNPJ"><TextInput value={doc} onChange={setDoc} inputMode="numeric" placeholder="só os números" /></Field>
              <Btn disabled={indo} onClick={() => agir({ acao: 'assinar', documento: doc, nome })}>{indo ? 'Preparando…' : 'Assinar'}</Btn>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn disabled={indo} onClick={() => agir({ acao: 'pagar' })}>{indo ? 'Buscando…' : 'Pagar a mensalidade'}</Btn>
              {!confirmarCancelar
                ? <Btn kind="ghost" onClick={() => setConfirmarCancelar(true)}>Cancelar assinatura</Btn>
                : <Btn kind="danger" disabled={indo} onClick={() => agir({ acao: 'cancelar' })}>Sim, cancelar</Btn>}
            </div>
          )}
          {link && (
            <div style={{ marginTop: 14 }}>
              <Btn kind="ok" href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', textDecoration: 'none' }}>Abrir a página de pagamento</Btn>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>Assim que o pagamento cair, o app libera sozinho (no Pix, em segundos).</div>
            </div>
          )}
          {msg && <div style={{ marginTop: 12, fontSize: 13.5, color: C.green, lineHeight: 1.5 }}>{msg}</div>}
          {erro && <div style={{ marginTop: 12, fontSize: 13.5, color: C.red, lineHeight: 1.5 }}>{erro}</div>}
        </Card>
      )}
    </div>
  );
}
