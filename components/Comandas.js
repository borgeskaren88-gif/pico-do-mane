'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, PageTitle } from './ui';
import { brl, num } from '../lib/util';

const CATS = ['Chopp / Cerveja', 'Drinks / Doses', 'Porções', 'Não alcoólicos', 'Sobremesas', 'Tabacaria', 'Combos', 'Outros'];
const FORMAS_PAG = ['Dinheiro', 'Pix', 'Crédito', 'Débito', 'Fiado'];

// O BALCÃO.
//
// "Tem pessoas que entram no bar, pedem uma cerveja e vão embora. Isso deveria
// contar como uma venda de uma comanda? Não deveria ser."
//
// Deveria contar como venda — é por ela que a cerveja sai do estoque e que o
// fiado fica pendurado num nome. O que não deveria é virar MESA: seis toques
// pra uma long neck, o grid entupido, e cada cerveja afundando o "ticket médio
// por mesa" como se fosse uma mesa que consumiu pouco.
//
// Esta tela é de propósito a mais burra do app: escolhe o que saiu, diz como
// pagou, cobra. Item com sabor ou adicional continua pela mesa — ali a pessoa
// senta, e o caminho comprido faz sentido. Tentar resolver os dois casos na
// mesma tela deixaria a tela do caso simples parecendo a do caso difícil.
function TelaBalcao({ cardapio, clientes, onCobrar, onSair, busy, erro }) {
  const [carrinho, setCarrinho] = useState([]); // [{ id, nome, preco, qtd }]
  const [busca, setBusca] = useState('');
  const [forma, setForma] = useState('');
  const [nome, setNome] = useState('');
  const [outro, setOutro] = useState(false);
  const [pessoas, setPessoas] = useState(1);
  const [desconto, setDesconto] = useState('');

  // Simples = sem sabor e sem adicional. O resto aparece numa linha explicando,
  // em vez de sumir: item que some da tela é item que a pessoa procura.
  const ehSimples = (i) => !(Array.isArray(i.sabores) && i.sabores.length) && !(Array.isArray(i.adicionais) && i.adicionais.length);
  const ativos = (cardapio || []).filter((i) => i && i.ativo !== false);
  const complicados = ativos.filter((i) => !ehSimples(i)).length;
  const lista = ativos.filter(ehSimples).filter((i) => !busca.trim() || (i.nome || '').toLowerCase().includes(busca.trim().toLowerCase()));

  const por = (id) => setCarrinho((cs) => {
    const ja = cs.find((x) => x.id === id);
    if (ja) return cs.map((x) => (x.id === id ? { ...x, qtd: x.qtd + 1 } : x));
    const prod = ativos.find((x) => x.id === id);
    return [...cs, { id, nome: prod.nome, preco: num(prod.preco), qtd: 1 }];
  });
  const mudarQtd = (id, d) => setCarrinho((cs) => cs
    .map((x) => (x.id === id ? { ...x, qtd: x.qtd + d } : x))
    .filter((x) => x.qtd > 0));

  const bruto = carrinho.reduce((s, x) => s + x.preco * x.qtd, 0);

  // DESCONTO NO BALCÃO, EM REAIS.
  //
  // Na mesa o desconto é em porcentagem, que é como se fecha uma conta grande.
  // No balcão ninguém pensa assim: pensa "tira dois reais" ou "deixa em vinte".
  // Então o campo é em R$ — mas o que vai pro servidor é a PORCENTAGEM, que é a
  // conta que o fechamento já sabe fazer. Nenhum caminho novo pro dinheiro.
  //
  // E a tela refaz a conta com a MESMA fórmula do servidor, a partir da mesma
  // porcentagem. Se ela calculasse o total do jeito dela, os dois podiam
  // discordar num centavo — e centavo que discorda é o começo de toda conta que
  // não fecha. Aqui eles concordam por construção.
  const descR = Math.min(Math.max(0, num(desconto)), bruto);
  const descontoPct = bruto > 0 ? (descR / bruto) * 100 : 0;
  const descAplicado = Math.round(bruto * descontoPct / 100 * 100) / 100;
  const total = Math.round((bruto - descAplicado) * 100) / 100;

  const precisaNome = forma === 'Fiado' && !nome.trim();
  const podeCobrar = carrinho.length > 0 && forma && !precisaNome && !busy && total > 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button onClick={onSair} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>‹ Voltar</button>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Balcão</div>
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
        Pediu e foi embora. Sai do estoque e entra no caixa igual a uma mesa — só não ocupa mesa nenhuma.
      </div>

      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      {carrinho.length > 0 && (
        <Card style={{ marginBottom: 12, padding: 12, borderColor: C.accent }}>
          {carrinho.map((x) => (
            <div key={x.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '6px 0' }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, minWidth: 0 }}>{x.nome}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button onClick={() => mudarQtd(x.id, -1)} style={estBtn}>–</button>
                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{x.qtd}</span>
                <button onClick={() => mudarQtd(x.id, +1)} style={estBtn}>+</button>
                <b style={{ minWidth: 72, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{brl(x.preco * x.qtd)}</b>
              </div>
            </div>
          ))}
          {/* Quando tem desconto, o de cima aparece riscado: ela precisa ver o
              que deixou de cobrar, não só o que vai cobrar. É esse número que
              some do caixa no fim da noite sem ninguém lembrar por quê. */}
          {descAplicado > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}`, fontSize: 13, color: C.faint }}>
                <span>Sem desconto</span>
                <span style={{ textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>{brl(bruto)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13, color: C.amber, fontWeight: 700 }}>
                <span>Desconto</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>− {brl(descAplicado)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Total</span>
            <b style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</b>
          </div>
        </Card>
      )}

      <div style={{ marginBottom: 10 }}><TextInput value={busca} onChange={setBusca} placeholder="Procurar no cardápio…" /></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {lista.map((i) => (
          <button key={i.id} onClick={() => por(i.id)} disabled={busy}
            style={{ border: `1px solid color-mix(in srgb, ${C.accent} 22%, ${C.panel})`, background: `color-mix(in srgb, ${C.accent} 7%, ${C.panel})`, color: C.text, borderRadius: 12, padding: '10px 14px', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
            {i.nome} <span style={{ color: C.faint, fontWeight: 600 }}>{brl(num(i.preco))}</span>
          </button>
        ))}
        {!lista.length && <Empty>{busca ? 'Nada com esse nome.' : 'Nenhum item simples no cardápio.'}</Empty>}
      </div>
      {complicados > 0 && (
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 16, lineHeight: 1.45 }}>
          {complicados} {complicados === 1 ? 'item tem' : 'itens têm'} sabor ou adicional pra escolher — {complicados === 1 ? 'esse continua' : 'esses continuam'} pela mesa.
        </div>
      )}

      {carrinho.length > 0 && (
        <>
          {/* O desconto vem ANTES do pagamento, porque é o total com desconto
              que ela vai cobrar. Depois seria tarde: o valor já estaria dito. */}
          <Field label="Desconto (R$) — deixa em branco se não teve">
            <NumInput value={desconto} onChange={setDesconto} />
          </Field>
          {descR > 0 && descAplicado >= bruto && (
            <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, margin: '-6px 0 12px' }}>
              Isso zera a conta. Se foi de graça mesmo, o caminho é cortesia, em Perdas e consumo — ali sai do estoque sem fingir que entrou dinheiro.
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Como pagou?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {FORMAS_PAG.map((f) => (
              <button key={f} onClick={() => setForma(f)} disabled={busy}
                style={{ border: 'none', borderRadius: 999, padding: '11px 18px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  background: forma === f ? C.accent : `color-mix(in srgb, ${C.accent} 10%, ${C.panel})`,
                  color: forma === f ? '#06101F' : C.text }}>{f}</button>
            ))}
          </div>

          {forma === 'Fiado' && (
            <div style={{ marginBottom: 14 }}>
              <Field label="Quem ficou devendo">
                {clientes.length && !outro ? (
                  <Select value={nome} onChange={(v) => { if (v === 'Outro (digitar)') { setOutro(true); setNome(''); } else setNome(v); }}
                    options={['', ...clientes, 'Outro (digitar)']} />
                ) : (
                  <TextInput value={nome} onChange={setNome} placeholder="Nome do cliente" />
                )}
              </Field>
              {precisaNome && <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginTop: 6 }}>Fiado sem nome vira dívida sem dono. Diz quem foi.</div>}
            </div>
          )}

          {/* Quantas pessoas: fica discreto porque quase sempre é 1 — mas
              existe, pra o "gasto por pessoa" não mentir quando foi um casal. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Quantas pessoas?</span>
            <button onClick={() => setPessoas((n) => Math.max(1, n - 1))} style={estBtn}>–</button>
            <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800 }}>{pessoas}</span>
            <button onClick={() => setPessoas((n) => Math.min(99, n + 1))} style={estBtn}>+</button>
          </div>

          <Btn kind="ok" onClick={() => onCobrar({ carrinho, forma, nome: nome.trim(), pessoas, total, descontoPct })} disabled={!podeCobrar}>
            {busy ? 'Cobrando…' : `Cobrar ${brl(total)}${forma ? ` · ${forma}` : ''}`}
          </Btn>
          {!forma && <div style={{ fontSize: 12, color: C.faint, marginTop: 8 }}>Falta dizer como pagou.</div>}
        </>
      )}
    </div>
  );
}

// QUANTAS PESSOAS SENTARAM NA MESA.
//
// Vive fora do componente porque agora é perguntado em DOIS momentos — ao abrir
// a mesa e, como rede de segurança, ao fechar a conta — e a pergunta tem que ter
// a mesma cara nos dois, senão vira duas coisas pra aprender.
//
// São três caminhos pro mesmo número, porque são dois jeitos de trabalhar:
//   1 a 8   um toque só, que é a esmagadora maioria das mesas;
//   +1      subir de um em um sem teclado, pra quem está com o celular na mão;
//   outro   digitar direto, que é o caminho curto de quem está no computador —
//           chegar em 14 clicando seis vezes é o tipo de chatice que faz alguém
//           parar de preencher.
function ContadorPessoas({ valor, onChange, titulo, aviso }) {
  const n = Number(valor) || 0;
  const falta = !(n >= 1);
  return (
    <div style={{
      background: falta ? `color-mix(in srgb, ${C.amber} 12%, transparent)` : C.panel2,
      border: `1px solid ${falta ? C.amber : C.line}`,
      borderRadius: 10, padding: '10px 12px', marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: falta ? C.amber : C.text }}>
        {titulo} {falta && aviso ? aviso : ''}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((v) => (
          <button key={v} onClick={() => onChange(v)} style={{
            border: `1px solid ${n === v ? C.accent : C.line}`,
            background: n === v ? C.accent : 'transparent',
            color: n === v ? '#06101F' : C.muted,
            borderRadius: 10, width: 42, height: 42, fontSize: 16, fontWeight: 800, cursor: 'pointer',
          }}>{v}</button>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
          <button onClick={() => onChange(Math.max(1, n + 1))} style={{
            border: `1px solid ${C.line}`, background: 'transparent', color: C.muted,
            borderRadius: 10, height: 42, padding: '0 12px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}>+1</button>
          <input
            type="number" min="1" max="99" inputMode="numeric"
            value={n > 8 ? String(n) : ''}
            onChange={(e) => {
              const v = Math.floor(Number(e.target.value) || 0);
              onChange(v >= 1 && v <= 99 ? v : 0);
            }}
            placeholder="outro"
            style={{
              width: 74, height: 42, boxSizing: 'border-box', textAlign: 'center',
              background: n > 8 ? C.accent : C.panel2,
              color: n > 8 ? '#06101F' : C.text,
              border: `1px solid ${n > 8 ? C.accent : C.line}`,
              borderRadius: 10, fontSize: 16, fontWeight: 800,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Formas aceitas num pagamento parcial. Fiado fica de fora de propósito: fiado
// é dívida, e ela tem nome, limite e lista própria — o caminho dela é o
// fechamento da conta.
const FORMAS_PARCIAL = ['Dinheiro', 'Pix', 'Crédito', 'Débito'];
// Quanto da mesa já foi pago por quem saiu mais cedo.
const somaParciais = (c) => Math.round((Array.isArray(c && c.parciais) ? c.parciais : [])
  .reduce((s, x) => s + (Number(x && x.valor) || 0), 0) * 100) / 100;

export default function Comandas({ papel = 'dona' }) {
  const [comandas, setComandas] = useState([]);
  const [cardapio, setCardapio] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [caixaAberto, setCaixaAberto] = useState(true); // otimista: só avisa quando sabe que está fechado
  const [mesasQtd, setMesasQtd] = useState(20);
  const [carregado, setCarregado] = useState(false);
  const [verValores, setVerValores] = useState(true); // mostrar/ocultar os R$ nas mesas (fica lembrado no aparelho)
  const [erro, setErro] = useState('');
  const [selId, setSelId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fechando, setFechando] = useState(false); // trava o botão de fechar conta (evita toque duplo no agito)
  const [configAberto, setConfigAberto] = useState(false);
  const [mesasInput, setMesasInput] = useState('');
  const [fecharForm, setFecharForm] = useState(null); // { pagamento, pessoas } quando fechando
  const [abrindo, setAbrindo] = useState(null); // { mesa, pessoas } enquanto pergunta quantos sentaram
  const [outroCliente, setOutroCliente] = useState(false); // digitar nome fora da lista de clientes
  const [busca, setBusca] = useState('');
  const [picker, setPicker] = useState(false); // tela de adicionar produtos (carrinho)
  const [balcao, setBalcao] = useState(false); // tela de venda de balcão (sem mesa)
  const [recibo, setRecibo] = useState(null);  // confirmação da última venda de balcão
  const [catSel, setCatSel] = useState(null); // categoria escolhida na tela de adicionar
  const [saborDe, setSaborDe] = useState(null); // item cujo seletor de sabor está aberto
  const [comboQtds, setComboQtds] = useState({}); // distribuição de sabores do combo (nome -> qtd)
  useEffect(() => { setComboQtds({}); }, [saborDe]);
  const [addDe, setAddDe] = useState(null);   // item cujo seletor de adicionais está aberto
  const [addQtds, setAddQtds] = useState({}); // adicionais escolhidos (nome -> qtd)
  useEffect(() => { setAddQtds({}); }, [addDe]);
  const [dividirPor, setDividirPor] = useState(2); // divisor da conta (quantas pessoas rachando)
  const [info, setInfo] = useState({ nome: '', pessoas: '', obs: '' });
  const infoDe = useRef(null); // id da comanda cujo info está carregado
  const editandoRef = useRef(false);

  // Uma volta "leve" traz só as mesas abertas e se o caixa está aberto — é o
  // que muda de minuto em minuto. O cardápio, os clientes e o nº de mesas quase
  // nunca mudam no meio do expediente, e vinham junto a cada 12 segundos
  // puxando o painel inteiro do banco. Agora só vêm na volta completa.
  const carregar = useCallback(async (leve = false) => {
    try {
      const r = await fetch(`/api/comandas${leve ? '?leve=1' : ''}`, { cache: 'no-store' });
      const j = await r.json();
      if (j.ok) {
        setComandas(j.comandas || []);
        setCaixaAberto(j.caixaAberto !== false);
        if (!j.leve) { setCardapio(j.cardapio || []); setClientes(j.clientes || []); if (j.mesasQtd) setMesasQtd(j.mesasQtd); }
        setErro('');
      } else setErro(j.erro || 'Erro ao carregar.');
    } catch { setErro('Sem conexão.'); }
    finally { setCarregado(true); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { try { if (localStorage.getItem('picoos-ver-valores-mesa') === '0') setVerValores(false); } catch { /* ignora */ } }, []);
  const toggleValores = () => setVerValores((v) => { const nv = !v; try { localStorage.setItem('picoos-ver-valores-mesa', nv ? '1' : '0'); } catch { /* ignora */ } return nv; });
  // Atualiza sozinho de tempos em tempos, pra um garçom ver as mesas do outro.
  // Não recarrega enquanto está mexendo numa comanda, pra não atrapalhar.
  // De 12 em 12 segundos vai a volta leve; uma vez por minuto vai a completa,
  // pra o cardápio e o "está acabando" não ficarem velhos na tela do garçom.
  const voltas = useRef(0);
  useEffect(() => {
    const t = setInterval(() => {
      if (editandoRef.current) return;
      voltas.current += 1;
      carregar(voltas.current % 5 !== 0);
    }, 12000);
    const onFoco = () => { if (!editandoRef.current) { voltas.current = 0; carregar(); } };
    window.addEventListener('focus', onFoco);
    return () => { clearInterval(t); window.removeEventListener('focus', onFoco); };
  }, [carregar]);

  // As ações de comanda deste aparelho rodam UMA DE CADA VEZ (fila). Assim,
  // salvar o nome e lançar um item não "brigam" no servidor: sem a fila, um
  // pedido podia ler a comanda antes do outro gravar e apagar o nome sem querer.
  const filaRef = useRef(Promise.resolve());
  // COBRAR NO BALCÃO.
  //
  // Vai tudo num pedido só — itens e pagamento juntos. Não é economia de
  // digitação: é que no meio do caminho não existe comanda nenhuma pra ficar
  // esquecida aberta se a internet cair entre um toque e outro.
  const cobrarBalcao = async ({ carrinho, forma, nome, pessoas, total, descontoPct }) => {
    const j = await acao({
      acao: 'balcao',
      itens: carrinho.map((x) => ({ cardapioId: x.id, qtd: x.qtd })),
      // O valor pago é o total JÁ COM desconto; a porcentagem vai junto pra o
      // servidor refazer a mesma conta e os dois baterem em centavo.
      pagamentos: [{ forma, valor: total }],
      descontoPct, nome, pessoas,
    }, { manterSel: false });
    if (j && j.ok) {
      setBalcao(false);
      setRecibo({ total, forma, nome, desconto: j.venda?.desconto || 0, quando: Date.now() });
    }
  };

  const acao = (payload, { manterSel = true } = {}) => {
    const run = async () => {
      setBusy(true);
      try {
        const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        if (!j.ok) { setErro(j.erro || 'Erro.'); return null; }
        if (j.comanda) {
          setComandas((cs) => {
            const outras = cs.filter((c) => c.id !== j.comanda.id);
            return [...outras, j.comanda].sort((a, b) => Number(a.mesa) - Number(b.mesa));
          });
          if (manterSel) setSelId(j.comanda.id);
        } else {
          await carregar();
        }
        setErro('');
        return j;
      } catch { setErro('Sem conexão.'); return null; }
      finally { setBusy(false); }
    };
    const p = filaRef.current.then(run, run);
    filaRef.current = p.then(() => {}, () => {});
    return p;
  };

  // Toca numa mesa do grid: se já tem comanda, entra; se não, PERGUNTA quantas
  // pessoas sentaram e só então abre.
  //
  // "Preciso que ela seja obrigada a fazer na hora que anota a comanda, depois
  // ela não vai lembrar quantas pessoas tinha na mesa."
  //
  // Antes a pergunta ficava só no fechamento. Garantia que o número existisse,
  // mas às duas da manhã ele vira chute — e chute anotado é pior que campo
  // vazio, porque tem cara de dado. Agora a conta começa pelo que só se sabe
  // ali: quantas pessoas acabaram de sentar.
  const tocarMesa = async (mesa) => {
    const existente = comandas.find((c) => String(c.mesa) === String(mesa));
    if (existente) { setSelId(existente.id); return; }
    setErro('');
    setAbrindo({ mesa: String(mesa), pessoas: 0 });
  };
  const confirmarAbrir = async () => {
    if (!abrindo || !(Number(abrindo.pessoas) >= 1)) return;
    const j = await acao({ acao: 'abrir', mesa: abrindo.mesa, pessoas: Number(abrindo.pessoas) });
    if (j?.comanda) { setAbrindo(null); setSelId(j.comanda.id); }
  };
  const salvarMesas = async () => {
    const n = Math.floor(Number(mesasInput));
    if (!(n >= 1 && n <= 80)) { setErro('Número de mesas inválido (1 a 80).'); return; }
    const j = await acao({ acao: 'config', mesasQtd: n }, { manterSel: true });
    if (j?.ok) { setMesasQtd(n); setConfigAberto(false); }
  };
  const addItem = (cardapioId, sabor, adicionais) => acao({ acao: 'add', comandaId: selId, cardapioId, ...(sabor ? { sabor } : {}), ...(adicionais ? { adicionais } : {}) });
  // Combo: distribui N unidades entre os sabores (ex.: 3 Tropical + 2 Melancia).
  const addCombo = (cardapioId, saboresQtd) => acao({ acao: 'add', comandaId: selId, cardapioId, saboresQtd });
  const setQtd = (itemId, qtd) => acao({ acao: 'setQtd', comandaId: selId, itemId, qtd });
  const remover = (itemId) => acao({ acao: 'remover', comandaId: selId, itemId });
  const cancelar = async (id) => {
    const c = comandas.find((x) => x.id === id);
    const vazia = !c || (c.itens || []).length === 0;
    const msg = vazia ? 'Excluir esta mesa aberta? (sem consumo lançado)' : 'Cancelar esta comanda? Todo o consumo lançado será apagado.';
    if (typeof window !== 'undefined' && !window.confirm(msg)) return;
    await acao({ acao: 'cancelar', comandaId: id }, { manterSel: false });
    setSelId(null);
  };
  // Pagamento parcial: alguém da mesa vai embora mais cedo e paga a parte dele.
  // A comanda continua aberta com o que falta.
  const [parcialForm, setParcialForm] = useState(null); // { valor, forma, quem }
  const lancarParcial = async () => {
    if (!parcialForm || busy) return;
    const valor = num(parcialForm.valor);
    if (!(valor > 0)) { setErro('Quanto essa pessoa pagou?'); return; }
    setErro('');
    const j = await acao({
      acao: 'parcial', comandaId: selId,
      valor, forma: parcialForm.forma || 'Dinheiro', quem: (parcialForm.quem || '').trim(),
    }, { manterSel: true });
    if (j?.ok) setParcialForm(null);
  };
  const desfazerParcial = async (parcialId) => {
    if (typeof window !== 'undefined' && !window.confirm('Desfazer este pagamento? O valor volta pra conta da mesa.')) return;
    await acao({ acao: 'desfazerParcial', comandaId: selId, parcialId }, { manterSel: true });
  };

  const confirmarFechar = async () => {
    if (fechando) return; // já está fechando: ignora toque duplo
    setFechando(true);
    setErro('');
    const pagamentos = FORMAS_PAG.map((f) => ({ forma: f, valor: num(fecharForm.valores[f] || '') })).filter((x) => x.valor > 0);
    const nomeCli = (fecharForm.nome || '').trim();
    const fiadoVal = num(fecharForm.valores['Fiado'] || '');
    // Trava: fiado sem nome não fecha (senão a dívida some numa "Mesa X").
    if (fiadoVal > 0.005 && !nomeCli) { setErro('Escreva o nome de quem ficou devendo pra fechar no fiado.'); setFechando(false); return; }
    // Trava: sem contar as pessoas não fecha. Antes o app escrevia "1 pessoa"
    // por conta própria, e o relatório da dona virava ficção.
    if (!(Number(fecharForm.pessoas) >= 1)) { setErro('Conta quantas pessoas estavam na mesa — é um toque, ali em cima.'); setFechando(false); return; }
    try {
      const r = await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'fechar', comandaId: selId, pagamentos, pessoas: fecharForm.pessoas, nome: nomeCli, descontoPct: num(fecharForm.descontoPct || 0) }) });
      const j = await r.json();
      if (!j.ok) {
        // A conta já não existe? Provável: um toque anterior já fechou e a
        // resposta se perdeu no agito. Trata como fechada — não assusta.
        if (/não encontrada|já fechada/i.test(j.erro || '')) { setFecharForm(null); setSelId(null); await carregar(); return; }
        setErro(j.erro || 'Não consegui fechar.');
        return;
      }
      // Ficou fiado com um nome que não está cadastrado? Oferece salvar como cliente,
      // pra da próxima ser só clicar no nome (e poder definir um limite depois).
      const norm = (s) => (s || '').trim().toLowerCase();
      if (fiadoVal > 0.005 && nomeCli && !clientes.some((n) => norm(n) === norm(nomeCli))) {
        if (typeof window !== 'undefined' && window.confirm(`Salvar "${nomeCli}" na sua lista de clientes?\n\nAssim, da próxima vez é só clicar no nome — e dá pra definir um limite de fiado pra ele na aba Clientes.`)) {
          try { await fetch('/api/comandas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'novoCliente', nome: nomeCli }) }); } catch { /* se falhar, a venda já está salva; ela cadastra depois */ }
        }
      }
      setFecharForm(null);
      setSelId(null);
      await carregar();
    } catch {
      setErro('Sem conexão — a conta pode não ter fechado. Confira a mesa e tente de novo.');
    } finally {
      setFechando(false);
    }
  };

  const totalDe = (c) => (c.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0) * (Number(it.preco) || 0), 0);
  // Conta com a taxa de serviço de 10% (ligada por padrão; some se a comanda tiver servico=false).
  const contaDe = (c) => {
    const subtotal = totalDe(c);
    const servicoOn = c && c.servico !== false;
    const servicoVal = servicoOn ? Math.round(subtotal * 0.10 * 100) / 100 : 0;
    return { subtotal, servicoOn, servicoVal, total: Math.round((subtotal + servicoVal) * 100) / 100 };
  };
  const sel = comandas.find((c) => c.id === selId) || null;
  useEffect(() => { editandoRef.current = !!selId; }, [selId]);
  // Ao abrir uma comanda, carrega os campos de nome/pessoas/obs pra edição.
  useEffect(() => {
    if (sel && infoDe.current !== sel.id) {
      infoDe.current = sel.id;
      setInfo({ nome: sel.nome || '', pessoas: sel.pessoas > 0 ? String(sel.pessoas) : '', obs: sel.obs || '' });
      setBusca(''); setFecharForm(null); setPicker(false);
    }
    if (!sel) { infoDe.current = null; }
  }, [sel]);

  // Salvar infos NUNCA muda a mesa selecionada (manterSel:false), pra um save
  // atrasado (do nome) não jogar a garçom de volta pra uma mesa antiga.
  const salvarInfos = (parcial) => acao({ acao: 'infos', comandaId: selId, ...parcial }, { manterSel: false });

  // Salva o nome sozinho pouco depois de parar de digitar (além de salvar ao
  // sair do campo), pra não perder o nome se a tela recarregar antes disso.
  const nomeTimer = useRef(null);
  const mudarNome = (v) => {
    setInfo((s) => ({ ...s, nome: v }));
    if (nomeTimer.current) clearTimeout(nomeTimer.current);
    nomeTimer.current = setTimeout(() => { nomeTimer.current = null; salvarInfos({ nome: v }); }, 900);
  };
  const salvarNomeAgora = () => { if (nomeTimer.current) { clearTimeout(nomeTimer.current); nomeTimer.current = null; } salvarInfos({ nome: info.nome }); };
  useEffect(() => () => { if (nomeTimer.current) clearTimeout(nomeTimer.current); }, []);

  // Formata o horário de abertura (HH:MM).
  const horaAbertura = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  const rotuloPapel = (x) => (x === 'garcom' ? 'Garçom' : x === 'dona' ? 'Dona' : '');

  const cardapioGrupos = useMemo(() => {
    const ordem = [...CATS, ''];
    const map = new Map();
    for (const it of cardapio) { const cat = it.categoria || ''; if (!map.has(cat)) map.set(cat, []); map.get(cat).push(it); }
    return [...map.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
      .map(([cat, itens]) => ({ cat: cat || 'Outros', itens: itens.sort((x, y) => (x.nome || '').localeCompare(y.nome || '')) }));
  }, [cardapio]);

  // ---- Tela de adicionar produtos (carrinho) ----
  if (sel && picker) {
    const total = contaDe(sel).total;
    const termoBusca = busca.trim().toLowerCase();
    const qtdNaComanda = (cardapioId) => (sel.itens.find((it) => it.cardapioId === cardapioId)?.qtd) || 0;
    const nItens = (sel.itens || []).reduce((s, it) => s + (Number(it.qtd) || 0), 0);
    const categorias = cardapioGrupos.map((g) => g.cat);
    const catAtiva = catSel && categorias.includes(catSel) ? catSel : categorias[0];
    // Com busca, mostra todos os itens que batem (ignora a categoria). Sem busca,
    // mostra só os da categoria escolhida na aba.
    const itensMostrar = termoBusca
      ? cardapioGrupos.flatMap((g) => g.itens).filter((it) => (it.nome || '').toLowerCase().includes(termoBusca))
      : (cardapioGrupos.find((g) => g.cat === catAtiva)?.itens || []);

    const linhaProduto = (it) => {
      const q = qtdNaComanda(it.id);
      const d = it.disp; // null = sem ficha; 0 = em falta; baixo = acabando
      const temSabores = Array.isArray(it.sabores) && it.sabores.length > 0;
      const temAdicionais = !temSabores && Array.isArray(it.adicionais) && it.adicionais.length > 0;
      return (
        <button key={it.id} onClick={() => (temSabores ? setSaborDe(it) : temAdicionais ? setAddDe(it) : addItem(it.id))} disabled={busy}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: C.accent, color: '#fff', fontSize: 20, fontWeight: 800, lineHeight: '26px', textAlign: 'center' }}>+</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{it.nome}</span>
          {temSabores && <span style={{ fontSize: 10, fontWeight: 800, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>sabores</span>}
          {temAdicionais && <span style={{ fontSize: 10, fontWeight: 800, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 999, padding: '1px 7px', flexShrink: 0 }}>adicionais</span>}
          {d === 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: C.red, borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>em falta</span>}
          {d != null && d > 0 && d <= 3 && <span style={{ fontSize: 11, fontWeight: 800, color: '#06101F', background: C.amber, borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>só {d}</span>}
          {q > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#06101F', background: C.green, borderRadius: 999, padding: '2px 8px', flexShrink: 0 }}>{q} na mesa</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl(num(it.preco))}</span>
        </button>
      );
    };

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => { setPicker(false); setBusca(''); }} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>‹ Voltar</button>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Adicionar · Mesa {sel.mesa}</div>
        </div>

        {saborDe && (
          <div onClick={() => setSaborDe(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.accent}`, borderRadius: 16, padding: 18, width: '100%', maxWidth: 360, boxShadow: '0 12px 44px rgba(0,0,0,.4)' }}>
              {(() => {
                const total = Math.floor(Number(saborDe.saboresTotal) || 0);
                if (total > 0) {
                  // Modo combo: distribui `total` unidades entre os sabores.
                  const soma = saborDe.sabores.reduce((a, s) => a + (Number(comboQtds[s.nome]) || 0), 0);
                  const falta = total - soma;
                  const completo = soma === total;
                  return (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{saborDe.nome}</div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Escolha {total} no total (pode misturar).</div>
                      {saborDe.sabores.map((s) => {
                        const n = Number(comboQtds[s.nome]) || 0;
                        return (
                          <div key={s.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.line}` }}>
                            <span style={{ fontSize: 15, fontWeight: 600 }}>{s.nome}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button onClick={() => setComboQtds((m) => ({ ...m, [s.nome]: Math.max(0, n - 1) }))} style={estBtn}>–</button>
                              <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                              <button disabled={soma >= total} onClick={() => setComboQtds((m) => ({ ...m, [s.nome]: n + 1 }))} style={{ ...estBtn, opacity: soma >= total ? 0.4 : 1 }}>+</button>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10, marginBottom: 10, color: completo ? C.green : C.amber }}>
                        {completo ? 'Completo!' : `Faltam ${falta}`} <span style={{ color: C.faint, fontWeight: 500 }}>· {soma}/{total}</span>
                      </div>
                      <Btn kind="ok" onClick={() => { addCombo(saborDe.id, comboQtds); setSaborDe(null); }} disabled={busy || !completo}>Adicionar</Btn>
                      <button onClick={() => setSaborDe(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '14px 0 0' }}>Cancelar</button>
                    </>
                  );
                }
                // Modo sabor único (ex.: caipirinha).
                return (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>{saborDe.nome} — qual sabor?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {saborDe.sabores.map((s) => (
                        <button key={s.nome} onClick={() => { addItem(saborDe.id, s.nome); setSaborDe(null); }} disabled={busy}
                          style={{ border: 'none', background: C.accent, color: '#06101F', borderRadius: 999, padding: '11px 18px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>{s.nome}</button>
                      ))}
                    </div>
                    <button onClick={() => setSaborDe(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '14px 0 0' }}>Cancelar</button>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {addDe && (() => {
          const base = num(addDe.preco);
          const escolhidos = (addDe.adicionais || []).map((a) => ({ a, n: Number(addQtds[a.nome]) || 0 })).filter((x) => x.n > 0);
          const somaAdd = escolhidos.reduce((t, x) => t + num(x.a.preco) * x.n, 0);
          return (
            <div onClick={() => setAddDe(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
              <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.accent}`, borderRadius: 16, padding: 18, width: '100%', maxWidth: 360, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 12px 44px rgba(0,0,0,.4)' }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{addDe.nome}</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Quer acrescentar alguma coisa? (pode pular)</div>
                {(addDe.adicionais || []).map((a) => {
                  const n = Number(addQtds[a.nome]) || 0;
                  return (
                    <div key={a.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.line}` }}>
                      <span style={{ minWidth: 0, fontSize: 15, fontWeight: 600 }}>
                        {a.nome}
                        <span style={{ fontSize: 12, color: C.green, fontWeight: 700, marginLeft: 6 }}>+{brl(num(a.preco))}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button onClick={() => setAddQtds((m) => ({ ...m, [a.nome]: Math.max(0, n - 1) }))} style={estBtn}>–</button>
                        <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                        <button onClick={() => setAddQtds((m) => ({ ...m, [a.nome]: n + 1 }))} style={estBtn}>+</button>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, marginTop: 12, marginBottom: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                  <span>Total do item</span>
                  <span style={{ color: C.green, fontVariantNumeric: 'tabular-nums' }}>{brl(base + somaAdd)}</span>
                </div>
                <Btn kind="ok" onClick={() => { addItem(addDe.id, null, addQtds); setAddDe(null); }} disabled={busy}>Adicionar</Btn>
                <button onClick={() => setAddDe(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '14px 0 0' }}>Cancelar</button>
              </div>
            </div>
          );
        })()}

        {cardapio.length > 0 && (
          <div style={{ marginBottom: 12 }}><TextInput value={busca} onChange={setBusca} placeholder="Buscar produto…" /></div>
        )}

        {cardapio.length === 0 ? <Empty>Cardápio vazio. Cadastre os itens na aba Cardápio.</Empty> : (
          <div className="picker-layout">
            {!termoBusca && (
              <div className="picker-cats">
                {categorias.map((cat) => (
                  <button key={cat} className={`picker-cat-chip${cat === catAtiva ? ' on' : ''}`} onClick={() => setCatSel(cat)}>{cat}</button>
                ))}
              </div>
            )}
            <div className="picker-produtos">
              {itensMostrar.length === 0 ? <Empty>Nenhum produto{termoBusca ? ' com esse nome' : ' nesta categoria'}.</Empty> : (
                <Card style={{ padding: 14 }}>
                  {termoBusca && <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: C.accent }}>Resultados</div>}
                  {itensMostrar.map((it) => linhaProduto(it))}
                </Card>
              )}
            </div>
          </div>
        )}

        <div style={{ position: 'sticky', bottom: 12, marginTop: 14 }}>
          <button onClick={() => { setPicker(false); setBusca(''); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', border: 'none', borderRadius: 14, padding: '14px 18px', background: C.accent, color: '#06101F', boxShadow: C.cardShadow }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Concluir</span>
            <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{nItens} item{nItens === 1 ? '' : 's'} · {brl(total)}</span>
          </button>
        </div>
      </div>
    );
  }

  // ---- Balcão: venda sem mesa ----
  if (balcao) {
    return (
      <TelaBalcao
        cardapio={cardapio} clientes={clientes} busy={busy} erro={erro}
        onCobrar={cobrarBalcao} onSair={() => { setBalcao(false); setErro(''); }}
      />
    );
  }

  // ---- Detalhe de uma comanda (só o que foi pedido) ----
  if (sel) {
    const conta = contaDe(sel);
    const total = conta.total;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button onClick={() => setSelId(null)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>‹ Mesas</button>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Mesa {sel.mesa}</div>
        </div>

        <Card style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>
            {horaAbertura(sel.abertaEm) && <>Aberta às <b style={{ color: C.muted }}>{horaAbertura(sel.abertaEm)}</b></>}
            {rotuloPapel(sel.abertaPor) && <> · por {rotuloPapel(sel.abertaPor)}</>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
            <Field label="Nome do cliente (opcional)"><TextInput value={info.nome} onChange={mudarNome} onBlur={salvarNomeAgora} placeholder="Ex.: João do balcão" /></Field>
            <Field label="Pessoas">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => { const n = Math.max(0, (Number(info.pessoas) || 0) - 1); setInfo((s) => ({ ...s, pessoas: n ? String(n) : '' })); salvarInfos({ pessoas: n }); }} style={estBtn}>–</button>
                <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{info.pessoas || '–'}</span>
                <button onClick={() => { const n = (Number(info.pessoas) || 0) + 1; setInfo((s) => ({ ...s, pessoas: String(n) })); salvarInfos({ pessoas: n }); }} style={estBtn}>+</button>
              </div>
            </Field>
          </div>
          <Field label="Observação (opcional)"><TextInput value={info.obs} onChange={(v) => setInfo((s) => ({ ...s, obs: v }))} onBlur={() => salvarInfos({ obs: info.obs })} placeholder="Ex.: sem cebola, cliente com pressa…" /></Field>
        </Card>

        <Card style={{ marginBottom: 14, padding: 14 }}>
          {sel.itens.length === 0 ? <Empty>Nada lançado ainda.<br />Toque em “Adicionar produtos” abaixo.</Empty> :
            sel.itens.map((it) => (
              <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 9, marginTop: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{it.nome}</div>
                  <div style={{ fontSize: 12, color: C.faint }}>{brl(num(it.preco))} cada</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setQtd(it.id, (Number(it.qtd) || 0) - 1)} disabled={busy} style={estBtn}>–</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{it.qtd}</span>
                  <button onClick={() => setQtd(it.id, (Number(it.qtd) || 0) + 1)} disabled={busy} style={estBtn}>+</button>
                </div>
                <div style={{ width: 78, textAlign: 'right', fontWeight: 800, color: C.green, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{brl((Number(it.qtd) || 0) * num(it.preco))}</div>
                <button onClick={() => remover(it.id)} disabled={busy} title="Remover" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}>×</button>
              </div>
            ))}
          {sel.itens.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `2px solid ${C.line}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 14 }}>
                <span style={{ color: C.muted }}>Consumo</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{brl(conta.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                <button onClick={() => salvarInfos({ servico: !conta.servicoOn })} disabled={busy}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted, fontSize: 14 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${conta.servicoOn ? C.accent : C.line}`, background: conta.servicoOn ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {conta.servicoOn && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06101F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>}
                  </span>
                  Serviço (10%)
                </button>
                <span style={{ fontWeight: 700, color: conta.servicoOn ? C.text : C.faint, fontVariantNumeric: 'tabular-nums' }}>{conta.servicoOn ? brl(conta.servicoVal) : 'retirado'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTop: `1px solid ${C.line}` }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Total da mesa</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(total)}</span>
              </div>
            </div>
          )}
        </Card>

        <div style={{ marginBottom: 14 }}>
          <Btn onClick={() => { setBusca(''); setCatSel(null); setPicker(true); }}>+ Adicionar produtos</Btn>
        </div>

        {/* ---- Alguém da mesa pagando a parte dele ---- */}
        {total > 0 && !fecharForm && (() => {
          const jaPago = somaParciais(sel);
          const falta = Math.round((total - jaPago) * 100) / 100;
          return (
            <Card style={{ marginBottom: 14, padding: 14, borderColor: jaPago > 0.005 ? C.green : C.line }}>
              {jaPago > 0.005 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.green, marginBottom: 6 }}>
                    Já pago: {brl(jaPago)} · falta {brl(falta)}
                  </div>
                  {(sel.parciais || []).map((x) => (
                    <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12.5, color: C.muted, padding: '3px 0' }}>
                      <span style={{ minWidth: 0 }}>{x.quem ? <b style={{ color: C.text }}>{x.quem}</b> : 'Alguém'} · {x.forma} · {horaAbertura(x.em)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <b style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{brl(x.valor)}</b>
                        <button onClick={() => desfazerParcial(x.id)} title="Desfazer" style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!parcialForm ? (
                <Btn kind="ghost" small onClick={() => setParcialForm({ valor: '', forma: 'Dinheiro', quem: '' })}>
                  Alguém vai pagar a parte dele
                </Btn>
              ) : (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Pagar uma parte</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.45 }}>
                    A mesa continua aberta com o que falta. Dividido por {Math.max(1, sel.pessoas || 1)} dá {brl(Math.round((falta / Math.max(1, sel.pessoas || 1)) * 100) / 100)} por pessoa.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Quanto"><NumInput value={parcialForm.valor} onChange={(v) => setParcialForm((f) => ({ ...f, valor: v }))} /></Field>
                    <Field label="Quem (opcional)"><TextInput value={parcialForm.quem} onChange={(v) => setParcialForm((f) => ({ ...f, quem: v }))} placeholder="ex: Ana" /></Field>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {FORMAS_PARCIAL.map((f) => (
                      <button key={f} onClick={() => setParcialForm((x) => ({ ...x, forma: f }))} style={{ border: `1px solid ${parcialForm.forma === f ? C.accent : C.line}`, background: parcialForm.forma === f ? C.accent : 'transparent', color: parcialForm.forma === f ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{f}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn kind="ok" small onClick={lancarParcial} disabled={busy}>Recebi {num(parcialForm.valor) > 0 ? brl(num(parcialForm.valor)) : ''}</Btn>
                    <Btn kind="ghost" small onClick={() => setParcialForm(null)}>Voltar</Btn>
                  </div>
                </div>
              )}
            </Card>
          );
        })()}

        {total > 0 && (
          fecharForm ? (() => {
            const descontoPct = Math.max(0, Math.min(100, num(fecharForm.descontoPct || 0)));
            const desconto = Math.round(total * descontoPct / 100 * 100) / 100;
            const totalFinal = Math.round((total - desconto) * 100) / 100;
            // O que já foi pago durante a noite não se cobra de novo.
            const jaPago = somaParciais(sel);
            const aReceber = Math.round((totalFinal - jaPago) * 100) / 100;
            const soma = FORMAS_PAG.reduce((s, f) => s + num(fecharForm.valores[f] || ''), 0);
            const falta = Math.round((aReceber - soma) * 100) / 100;
            const fiadoVal = num(fecharForm.valores['Fiado'] || '');
            const confere = Math.abs(falta) <= 0.005;
            // Fiado SEM nome não pode: senão vira "Mesa X" e você não sabe quem deve.
            const precisaNome = fiadoVal > 0.005 && !(fecharForm.nome || '').trim();
            // Mesma família do precisaNome: o que falta pra poder fechar.
            const faltaPessoas = !(Number(fecharForm.pessoas) >= 1);
            const setVal = (f) => (v) => setFecharForm((s) => ({ ...s, valores: { ...s.valores, [f]: v } }));
            const setDesc = (p) => setFecharForm((s) => ({ ...s, descontoPct: p, valores: {} }));
            const preencherResto = (f) => {
              const outros = FORMAS_PAG.filter((x) => x !== f).reduce((s, x) => s + num(fecharForm.valores[x] || ''), 0);
              const resto = Math.round((aReceber - outros) * 100) / 100;
              setFecharForm((s) => ({ ...s, valores: { ...s.valores, [f]: resto > 0 ? resto.toFixed(2).replace('.', ',') : '' } }));
            };
            return (
              <Card style={{ marginBottom: 14, padding: 14, borderColor: C.green }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>
                  Fechar conta — {jaPago > 0.005 ? <>falta {brl(aReceber)}</> : brl(total)}
                </div>
                {jaPago > 0.005 && (
                  <div style={{ fontSize: 12.5, color: C.green, marginBottom: 6 }}>
                    Conta de {brl(totalFinal)} · <b>{brl(jaPago)} já pago</b> durante a noite.
                  </div>
                )}
                {/* Rede de segurança: mesa aberta ANTES desta regra existir
                    (ou aberta por uma tela velha) chega aqui sem o número. Em
                    vez de deixar passar, pergunta — e o fechamento espera. */}
                <ContadorPessoas
                  valor={fecharForm.pessoas}
                  onChange={(v) => setFecharForm((f) => ({ ...f, pessoas: v }))}
                  titulo="Quantas pessoas na mesa?"
                  aviso="(precisa dizer pra fechar)"
                />
                {Number(fecharForm.pessoas) >= 1 && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: -6, marginBottom: 12 }}>
                    {fecharForm.pessoas} {Number(fecharForm.pessoas) === 1 ? 'pessoa' : 'pessoas'} · {brl(Math.round((totalFinal / Number(fecharForm.pessoas)) * 100) / 100)} por pessoa
                  </div>
                )}

                <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Quanto entrou em cada forma? Dá pra dividir. Use “resto” pra completar.</div>

                {/* Sem caixa aberto a venda fica solta: não entra no fechamento
                    do turno nem, por tabela, na receita do dia. Dá pra fechar
                    assim mesmo — e depois puxar a venda na tela do Caixa. */}
                {!caixaAberto && (
                  <div style={{ background: `color-mix(in srgb, ${C.amber} 12%, transparent)`, border: `1px solid ${C.amber}`, borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>
                    <b style={{ color: C.amber }}>Não tem caixa aberto.</b> Dá pra fechar assim mesmo, mas essa venda fica de fora do turno e da receita do dia. O certo é abrir o caixa antes — e, se já fechou, é só ir na aba Caixa e puxar a venda pra lá.
                  </div>
                )}

                {/* Desconto (%) — abate do total da conta */}
                <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Desconto</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[0, 5, 10, 15].map((p) => (
                      <button key={p} onClick={() => setDesc(p)} style={{ border: `1px solid ${descontoPct === p ? C.accent : C.line}`, background: descontoPct === p ? C.accent : 'transparent', color: descontoPct === p ? '#06101F' : C.muted, borderRadius: 999, padding: '7px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{p === 0 ? 'Sem' : p + '%'}</button>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
                      <div style={{ width: 62 }}><NumInput value={descontoPct ? String(descontoPct) : ''} onChange={(v) => setDesc(num(v))} placeholder="outro" /></div>
                      <span style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>%</span>
                    </div>
                  </div>
                  {descontoPct > 0 && <div style={{ fontSize: 14, fontWeight: 800, color: C.accent, marginTop: 8 }}>− {brl(desconto)} · Total com desconto: {brl(totalFinal)}</div>}
                </div>

                {/* Dividir a conta (calculadora de rachar) — só pra ver quanto fica por pessoa */}
                <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Dividir a conta entre</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setDividirPor((n) => Math.max(1, n - 1))} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: 'transparent', color: C.text, fontSize: 20, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>–</button>
                      <span style={{ minWidth: 46, textAlign: 'center', fontSize: 15, fontWeight: 800 }}>{dividirPor} {dividirPor === 1 ? 'pessoa' : 'pessoas'}</span>
                      <button onClick={() => setDividirPor((n) => Math.min(50, n + 1))} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: 'transparent', color: C.text, fontSize: 20, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>+</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.accent, marginTop: 8, textAlign: 'center' }}>{brl(totalFinal / dividirPor)} <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>por pessoa</span></div>
                </div>

                {FORMAS_PAG.map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 82, flexShrink: 0, fontSize: 13, fontWeight: 700, color: f === 'Fiado' ? C.amber : C.text }}>{f}</span>
                    <div style={{ flex: 1, minWidth: 0 }}><NumInput value={fecharForm.valores[f] || ''} onChange={setVal(f)} /></div>
                    <button onClick={() => preencherResto(f)} style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: '7px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>resto</button>
                  </div>
                ))}
                <div style={{ fontSize: 13, marginTop: 4, marginBottom: fiadoVal > 0 ? 10 : 6, fontWeight: 700, color: confere ? C.green : C.amber }}>
                  {confere ? 'Confere!' : falta > 0 ? `Falta ${brl(falta)}` : `Passou ${brl(-falta)}`}
                  <span style={{ color: C.faint, fontWeight: 500 }}> · somado {brl(soma)} de {brl(totalFinal)}</span>
                </div>
                {fiadoVal > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <Field label="Quem ficou devendo? (obrigatório)">
                      {clientes.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <Select
                            value={outroCliente ? 'Outro (digitar)' : fecharForm.nome}
                            onChange={(v) => { if (v === 'Outro (digitar)') { setOutroCliente(true); setFecharForm((s) => ({ ...s, nome: '' })); } else { setOutroCliente(false); setFecharForm((s) => ({ ...s, nome: v })); } }}
                            options={[...clientes, 'Outro (digitar)']} placeholder="Selecionar cliente" />
                          {outroCliente && <TextInput value={fecharForm.nome} onChange={(v) => setFecharForm((s) => ({ ...s, nome: v }))} placeholder="Nome do cliente" />}
                        </div>
                      ) : (
                        <TextInput value={fecharForm.nome} onChange={(v) => setFecharForm((s) => ({ ...s, nome: v }))} placeholder="Nome do cliente" />
                      )}
                    </Field>
                    <div style={{ fontSize: 11, color: C.amber, marginTop: 6 }}>{brl(fiadoVal)} vai pra lista de Fiados (não entra no caixa até você marcar “Recebi”).</div>
                    {precisaNome && <div style={{ fontSize: 12, color: C.red, fontWeight: 700, marginTop: 6 }}>⚠️ Escreva o nome de quem ficou devendo pra poder fechar no fiado.</div>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Btn kind="ok" onClick={confirmarFechar} disabled={busy || fechando || !confere || precisaNome || faltaPessoas}>{fechando ? 'Fechando…' : 'Confirmar'}</Btn>
                  <Btn kind="ghost" onClick={() => setFecharForm(null)}>Voltar</Btn>
                </div>
                {/* Botão apagado sem explicação é o mesmo que botão quebrado:
                    ela toca, não acontece nada, e conclui que o app travou. */}
                {faltaPessoas && (
                  <div style={{ fontSize: 12.5, color: C.amber, fontWeight: 700, marginTop: 8, lineHeight: 1.45 }}>
                    Falta dizer quantas pessoas estavam na mesa — é o primeiro quadro aqui de cima.
                  </div>
                )}
              </Card>
            );
          })() : (
            <div style={{ marginBottom: 14 }}>
              <Btn kind="ok" onClick={() => { setOutroCliente(!!(sel.nome && !clientes.includes(sel.nome))); setDividirPor(sel.pessoas > 0 ? sel.pessoas : 2); setFecharForm({ valores: {}, nome: sel.nome || '', pessoas: sel.pessoas > 0 ? sel.pessoas : 0 }); }}>Fechar conta · {brl(Math.round((total - somaParciais(sel)) * 100) / 100)}</Btn>
            </div>
          )
        )}

        {(papel === 'dona' || sel.itens.length === 0) && (
          <div style={{ marginTop: 8 }}>
            <Btn kind="danger" small onClick={() => cancelar(sel.id)}>{sel.itens.length === 0 ? 'Excluir mesa (aberta sem querer)' : 'Cancelar comanda'}</Btn>
          </div>
        )}
      </div>
    );
  }

  // ---- Painel de mesas (grid como o Consumer) ----
  // Monta a lista de mesas: 1..mesasQtd + qualquer mesa aberta fora dessa faixa.
  const abertasPorMesa = new Map(comandas.map((c) => [String(c.mesa), c]));
  const numeros = [];
  for (let i = 1; i <= mesasQtd; i++) numeros.push(String(i));
  for (const c of comandas) { const m = String(c.mesa); if (!numeros.includes(m)) numeros.push(m); }
  // Ordem numérica fixa: cada mesa sempre no mesmo lugar, pra o garçom não se
  // confundir (a posição não muda quando abre/fecha).
  numeros.sort((a, b) => Number(a) - Number(b));
  const nAbertas = comandas.length;

  return (
    <div>
      <PageTitle sub={`${nAbertas} mesa${nAbertas === 1 ? '' : 's'} ocupada${nAbertas === 1 ? '' : 's'} de ${mesasQtd}`}>Comandas</PageTitle>

      {/* O BALCÃO FICA FORA DO GRID, de propósito.
          Se virasse mais um quadradinho entre as mesas, voltaria a ser uma
          mesa — que é exatamente o que ele não é. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: -6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => { setBalcao(true); setRecibo(null); setErro(''); }}
          style={{ border: 'none', background: C.accent, color: '#06101F', borderRadius: 12, padding: '10px 16px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>
          Balcão
        </button>
        <button onClick={toggleValores} title="Mostrar ou esconder os valores das mesas"
          style={{ background: 'none', border: `1px solid ${C.line}`, color: C.muted, borderRadius: 9, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {verValores ? 'Ocultar valores' : 'Mostrar valores'}
        </button>
      </div>

      {erro && <div style={{ fontSize: 13, color: C.red, marginBottom: 10 }}>{erro}</div>}

      {/* O RECIBO DO BALCÃO.
          A venda de balcão não deixa rastro na tela — não fica mesa aberta
          pra ela olhar e saber que deu certo. Sem esta confirmação, o toque
          no "Cobrar" devolveria a mesma tela de antes, e ela lançaria de novo
          achando que não pegou. */}
      {recibo && (
        <Card style={{ marginBottom: 12, padding: '12px 14px', borderColor: C.green }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: C.green }}>
            Balcão: {brl(recibo.total)} · {recibo.forma}{recibo.nome ? ` · ${recibo.nome}` : ''}
            {recibo.desconto > 0 ? ` · ${brl(recibo.desconto)} de desconto` : ''}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Já entrou no caixa e saiu do estoque.</div>
          <button onClick={() => setRecibo(null)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '8px 0 0' }}>ok</button>
        </Card>
      )}

      {/* A PERGUNTA QUE ABRE A MESA.
          Aparece no lugar do grid, ocupando a tela: enquanto ela não disser
          quantos sentaram, não tem mesa nenhuma pra tocar por engano. É um
          toque, e é o único momento em que essa informação existe de verdade. */}
      {abrindo && (
        <Card style={{ marginBottom: 14, padding: 14, borderColor: C.accent }}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 2 }}>Mesa {abrindo.mesa}</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12, lineHeight: 1.45 }}>
            Quantas pessoas sentaram? Marca agora — <b style={{ color: C.text }}>na hora de fechar ninguém lembra</b>.
          </div>
          <ContadorPessoas
            valor={abrindo.pessoas}
            onChange={(v) => setAbrindo((a) => ({ ...a, pessoas: v }))}
            titulo="Quantas pessoas na mesa?"
            aviso="(precisa dizer pra abrir)"
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn kind="ok" onClick={confirmarAbrir} disabled={busy || !(Number(abrindo.pessoas) >= 1)}>
              {busy ? 'Abrindo…' : `Abrir mesa ${abrindo.mesa}`}
            </Btn>
            <Btn kind="ghost" onClick={() => setAbrindo(null)}>Cancelar</Btn>
          </div>
          {!(Number(abrindo.pessoas) >= 1) && (
            <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginTop: 8 }}>
              Toca no número de pessoas pra liberar a mesa.
            </div>
          )}
        </Card>
      )}

      {!carregado ? <Empty>Carregando…</Empty> : abrindo ? null : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10 }}>
          {numeros.map((m) => {
            const c = abertasPorMesa.get(m);
            const ocupada = !!c;
            const total = ocupada ? contaDe(c).total : 0;
            const escuroSobreAzul = 'rgba(6,16,31,0.62)';
            return (
              <button key={m} onClick={() => (ocupada ? setSelId(c.id) : tocarMesa(m))} disabled={busy}
                style={{
                  cursor: 'pointer', borderRadius: 18, padding: ocupada ? '14px 10px 12px' : '16px 10px', minHeight: 104,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  border: ocupada ? 'none' : `1px solid color-mix(in srgb, ${C.accent} 16%, ${C.panel})`,
                  background: ocupada ? C.accent : `color-mix(in srgb, ${C.accent} 7%, ${C.panel})`,
                  boxShadow: ocupada ? C.cardShadow : 'none',
                  color: ocupada ? '#06101F' : C.text,
                  transition: 'transform .08s ease',
                }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: ocupada ? escuroSobreAzul : C.faint }}>
                  {ocupada ? 'Ocupada' : 'Livre'}
                </span>
                <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, color: ocupada ? '#06101F' : C.accent }}>{m}</span>
                {!ocupada && <span style={{ fontSize: 10, fontWeight: 700, color: C.faint, letterSpacing: '.02em' }}>toque p/ abrir</span>}
                {ocupada && c.nome && <span style={{ fontSize: 11, fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: escuroSobreAzul }}>{c.nome}</span>}
                {ocupada && <span style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{verValores ? brl(total) : 'R$ •••'}</span>}
                {ocupada && c.pessoas > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: escuroSobreAzul }}>{c.pessoas} pessoa{c.pessoas === 1 ? '' : 's'}</span>}
              </button>
            );
          })}
        </div>
      )}

      {papel === 'dona' && (
        <div style={{ marginTop: 18 }}>
          {!configAberto ? (
            <button onClick={() => { setMesasInput(String(mesasQtd)); setConfigAberto(true); }}
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: 0 }}>
              Configurar nº de mesas ({mesasQtd})
            </button>
          ) : (
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Quantas mesas tem o salão?</div>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 10 }}>Vira o grid de mesas que você e os garçons usam.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 100 }}><TextInput value={mesasInput} onChange={setMesasInput} inputMode="numeric" placeholder="20" /></div>
                <Btn small onClick={salvarMesas} disabled={busy}>Salvar</Btn>
                <Btn kind="ghost" small onClick={() => setConfigAberto(false)}>Cancelar</Btn>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

const estBtn = { width: 30, height: 30, borderRadius: 8, border: `1px solid var(--c-line)`, background: 'transparent', color: 'var(--c-text)', fontSize: 18, fontWeight: 800, cursor: 'pointer', lineHeight: 1 };
