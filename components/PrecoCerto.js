'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { C, Card, Btn, Field, TextInput, NumInput, Select, Empty, PageTitle, Label } from './ui';
import { brl, num, todayISO, uid } from '../lib/util';
import { custoDaFicha, custoDosSabores } from '../lib/estoque';
import { CMV_BOM, CMV_ATENCAO } from '../lib/cmv';
import { rateioDoMes, mesFechadoAnterior } from '../lib/rateio';

// PREÇO CERTO — quanto COBRAR.
//
// A tela de Margem responde "dos preços que já estão lá, quais dão lucro?".
// Esta responde a pergunta de antes: "quanto eu devo cobrar?". São o diagnóstico
// e a receita; uma olha pra trás, a outra decide.
//
// A CONTA, e por que ela não é a de todo mundo:
//
//   Quase todo mundo faz preço multiplicando o custo ("3x o custo"). Isso é
//   MARKUP, e ele ignora que imposto, taxa de cartão e comissão são cobrados
//   em cima do PREÇO, não do custo. Vender a 3x o custo com 6% de imposto e
//   3,5% de cartão não dá 66% de margem; dá menos, e ninguém sabe quanto.
//
//   Aqui a conta é pela margem sobre a venda. De cada R$ 1,00 que entra, uma
//   fatia já tem dono (imposto, cartão, comissão, delivery) e outra é a margem
//   que ela quer. O que sobra tem que pagar o custo:
//
//       preço × (1 − taxas − margem) = custo
//       preço = custo ÷ (1 − taxas − margem)
//
//   Se taxas + margem passar de 100%, não existe preço que feche — e a tela
//   diz isso em vez de mostrar um número gigante ou um negativo.
//
// O QUE ESTA CALCULADORA TEM QUE AS DA INTERNET NÃO TÊM: o custo não precisa
// ser digitado. A ficha técnica já está no sistema. Ela escolhe o produto e o
// custo vem — e, melhor, a tela compara com o preço que ela JÁ cobra e diz
// quanto está deixando na mesa em cada unidade.

const PADRAO = { impostos: '', cartao: '', comissao: '', delivery: '', margem: '' };

// Arredonda PRA CIMA no meio real. Pra baixo ela perderia margem justamente no
// item que acabou de calcular — e meio real é o degrau que um bar usa.
const redondo = (v) => Math.ceil(v * 2 - 1e-9) / 2;

const pct = (v) => Math.max(0, num(v));

export default function PrecoCerto({ cardapio = [], fichas = [], estoque = [], despesas = [], vendas = [], base, onBase, onCardapio }) {
  const [modo, setModo] = useState('cardapio'); // 'cardapio' | 'zero'
  const [itemId, setItemId] = useState('');
  const [taxas, setTaxas] = useState(() => ({ ...PADRAO, ...(base || {}) }));
  const [confirmando, setConfirmando] = useState(false);
  const [aplicado, setAplicado] = useState('');

  // Cálculo do zero, pra quem ainda não tem ficha (ou pra um prato novo que
  // ainda nem existe no cardápio).
  const [ingredientes, setIngredientes] = useState([{ id: uid(), nome: '', valor: '' }]);
  const [rende, setRende] = useState('');
  const [embalagem, setEmbalagem] = useState('');
  const [rateio, setRateio] = useState('');

  // As taxas são as MESMAS pra todo produto do bar: imposto, cartão e delivery
  // não mudam de prato pra prato. Digitar de novo a cada item seria trabalho
  // repetido — então ficam guardadas e já vêm preenchidas na próxima vez.
  useEffect(() => { if (base && typeof base === 'object') setTaxas((t) => ({ ...t, ...base })); }, [base]);
  const mudarTaxa = (k) => (v) => {
    const novo = { ...taxas, [k]: v };
    setTaxas(novo);
    if (onBase) onBase(novo);
  };

  // O rateio do fixo, calculado do último mês FECHADO dela.
  const rateioAuto = useMemo(
    () => rateioDoMes({ despesas, vendas, mes: mesFechadoAnterior(todayISO()) }),
    [despesas, vendas],
  );

  const fichaPorId = useMemo(
    () => new Map(fichas.filter((f) => f && f.cardapioId).map((f) => [f.cardapioId, Array.isArray(f.itens) ? f.itens : []])),
    [fichas],
  );

  const ativos = useMemo(() => cardapio.filter((c) => c && c.ativo !== false), [cardapio]);
  const opcoes = useMemo(
    () => ativos.map((c) => ({ value: c.id, label: `${c.nome}${num(c.preco) > 0 ? ` · hoje ${brl(num(c.preco))}` : ''}` })),
    [ativos],
  );
  const item = ativos.find((c) => c.id === itemId) || null;

  // ---- custo de uma unidade ----
  const custo = useMemo(() => {
    if (modo === 'cardapio') {
      if (!item) return { valor: 0, pronto: false, motivo: 'escolhe' };
      const ficha = fichaPorId.get(item.id);
      if (!ficha || !ficha.length) return { valor: 0, pronto: false, motivo: 'sem-ficha' };
      const b = custoDaFicha(ficha, estoque);
      const sab = custoDosSabores(item.sabores, estoque, item.saboresTotal);
      const v = Math.round((b.custo + sab.medio + num(embalagem) + num(rateio)) * 100) / 100;
      return { valor: v, pronto: v > 0, completo: b.completo, motivo: v > 0 ? '' : 'sem-custo' };
    }
    const soma = ingredientes.reduce((s, i) => s + num(i.valor), 0);
    const n = Math.max(0, num(rende));
    if (!(soma > 0)) return { valor: 0, pronto: false, motivo: 'sem-ingrediente' };
    if (!(n > 0)) return { valor: 0, pronto: false, motivo: 'sem-rendimento' };
    const v = Math.round((soma / n + num(embalagem) + num(rateio)) * 100) / 100;
    return { valor: v, pronto: v > 0, motivo: '' };
  }, [modo, item, fichaPorId, estoque, ingredientes, rende, embalagem, rateio]);

  // ---- a conta ----
  const conta = useMemo(() => {
    const t = pct(taxas.impostos) + pct(taxas.cartao) + pct(taxas.comissao) + pct(taxas.delivery);
    const m = pct(taxas.margem);
    const sobra = 1 - (t + m) / 100;
    if (!(m > 0)) return { estado: 'sem-margem', taxasPct: t };
    if (sobra <= 0) return { estado: 'impossivel', taxasPct: t, margemPct: m, soma: t + m };
    if (!custo.pronto) return { estado: 'sem-custo', taxasPct: t, margemPct: m };
    const preco = custo.valor / sobra;
    const sugerido = redondo(preco);
    return {
      estado: 'ok', taxasPct: t, margemPct: m, preco, sugerido,
      markup: custo.valor > 0 ? preco / custo.valor : 0,
      lucro: preco * (m / 100),
      // Com o arredondamento pra cima, a margem fica um tiquinho melhor.
      margemNoSugerido: sugerido > 0 ? ((1 - t / 100) - custo.valor / sugerido) * 100 : 0,
      lucroNoSugerido: sugerido * (1 - t / 100) - custo.valor,
    };
  }, [taxas, custo]);

  const hojePreco = modo === 'cardapio' && item ? num(item.preco) : 0;

  // ---- o que o preço de hoje realmente dá ----
  // O pulo do gato desta tela. A calculadora diz quanto cobrar; isto diz
  // quanto ela está deixando na mesa por NÃO cobrar.
  const hoje = useMemo(() => {
    const p = modo === 'cardapio' && item ? num(item.preco) : 0;
    if (!(p > 0) || !custo.pronto) return null;
    const t = conta.taxasPct || 0;
    const sobraReais = p * (1 - t / 100) - custo.valor;
    return { preco: p, margem: (sobraReais / p) * 100, lucro: sobraReais };
  }, [modo, item, custo, conta]);

  // O ingrediente como fatia do preço — o CMV do item, antes de o preço existir.
  const custoPct = conta.estado === 'ok' && conta.preco > 0 ? (custo.valor / conta.preco) * 100 : null;
  // Quanto o preço sugerido sobe em cima do que ela cobra hoje. É o tamanho
  // do salto que diz se a conta "× 100 unidades" ainda vale alguma coisa.
  const saltoPct = conta.estado === 'ok' && hojePreco > 0 ? ((conta.sugerido - hojePreco) / hojePreco) * 100 : 0;

  const fatias = useMemo(() => {
    if (conta.estado !== 'ok') return [];
    const p = conta.preco;
    const f = [
      ['Custo do produto', (custo.valor / p) * 100, C.amber],
      ['Impostos', pct(taxas.impostos), '#7AA6F5'],
      ['Taxa do cartão', pct(taxas.cartao), '#5BC8C2'],
      ['Comissão', pct(taxas.comissao), '#C88BEA'],
      ['Delivery / marketplace', pct(taxas.delivery), '#F2A65A'],
      ['Teu lucro', conta.margemPct, C.green],
    ];
    return f.filter(([, v]) => v > 0.01);
  }, [conta, custo, taxas]);

  const addIng = () => setIngredientes((l) => [...l, { id: uid(), nome: '', valor: '' }]);
  const tiraIng = (id) => setIngredientes((l) => (l.length <= 1 ? l : l.filter((i) => i.id !== id)));
  const mudaIng = (id, campo, v) => setIngredientes((l) => l.map((i) => (i.id === id ? { ...i, [campo]: v } : i)));

  const aplicarNoCardapio = () => {
    if (!item || conta.estado !== 'ok' || !onCardapio) return;
    const novo = conta.sugerido.toFixed(2).replace('.', ',');
    onCardapio(cardapio.map((c) => (c.id === item.id ? { ...c, preco: novo } : c)));
    setAplicado(novo);
    setConfirmando(false);
  };

  const campoPct = (k, rot, dica, exemplo) => (
    <div style={{ marginBottom: 12 }}>
      <Label>{rot}</Label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}><NumInput value={taxas[k]} onChange={mudarTaxa(k)} placeholder={exemplo} /></div>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.faint, flexShrink: 0 }}>%</span>
      </div>
      {dica && <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, lineHeight: 1.45 }}>{dica}</div>}
    </div>
  );

  return (
    <div>
      <PageTitle sub="Quanto cobrar pra sobrar o que tu quer, já contando imposto e cartão">Preço certo</PageTitle>

      <Card style={{ marginBottom: 14, background: C.panel2 }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          A tela de <b style={{ color: C.text }}>Margem</b> olha os preços que já estão no cardápio e diz quais dão lucro.
          Esta aqui é a de antes: <b style={{ color: C.text }}>quanto cobrar</b>. Escolhe o produto, diz quanto tu quer
          ganhar, e ela faz o preço contando imposto, cartão e comissão — que saem de cada venda e quase ninguém põe na conta.
        </div>
      </Card>

      {/* 1 — O CUSTO */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: C.accent, fontWeight: 700, marginBottom: 4 }}>
          1 · Quanto custa uma unidade
        </div>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 12, lineHeight: 1.45 }}>
          Se o produto já tem ficha técnica, o custo vem sozinho — não precisa digitar ingrediente nenhum.
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[['cardapio', 'Produto do cardápio'], ['zero', 'Calcular do zero']].map(([v, rot]) => (
            <button key={v} onClick={() => setModo(v)} style={{
              borderRadius: 999, padding: '7px 14px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
              border: `1px solid ${modo === v ? C.accent : C.line}`,
              background: modo === v ? C.accent : 'transparent',
              color: modo === v ? '#06101F' : C.muted,
            }}>{rot}</button>
          ))}
        </div>

        {modo === 'cardapio' ? (
          <>
            <Field label="Produto">
              <Select value={itemId} onChange={(v) => { setItemId(v); setAplicado(''); setConfirmando(false); }} options={opcoes} placeholder="Escolhe o produto…" />
            </Field>
            {custo.motivo === 'sem-ficha' && (
              <div style={{ fontSize: 12.5, color: C.amber, lineHeight: 1.5, marginBottom: 10 }}>
                ⚠️ <b>{item && item.nome}</b> não tem ficha técnica, então o sistema não sabe quanto ele custa.
                Monta a ficha em <b style={{ color: C.text }}>Abastecimento → Estoque → Fichas técnicas</b>, ou usa
                aqui o <b style={{ color: C.text }}>Calcular do zero</b>.
              </div>
            )}
            {custo.motivo === 'sem-custo' && (
              <div style={{ fontSize: 12.5, color: C.amber, lineHeight: 1.5, marginBottom: 10 }}>
                ⚠️ A ficha existe, mas os ingredientes dela estão <b>sem custo cadastrado</b> no estoque. Põe o custo
                deles que o número aparece aqui.
              </div>
            )}
            {custo.pronto && custo.completo === false && (
              <div style={{ fontSize: 12, color: C.amber, lineHeight: 1.5, marginBottom: 10 }}>
                Atenção: algum ingrediente da ficha está sem custo. O custo abaixo sai <b>por baixo</b> — e o preço, também.
              </div>
            )}
          </>
        ) : (
          <>
            <Label>Ingredientes da receita inteira</Label>
            {ingredientes.map((i) => (
              <div key={i.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <div style={{ flex: 1.3, minWidth: 0 }}><TextInput value={i.nome} onChange={(v) => mudaIng(i.id, 'nome', v)} placeholder="Ingrediente" /></div>
                <div style={{ flex: 1, minWidth: 0 }}><NumInput value={i.valor} onChange={(v) => mudaIng(i.id, 'valor', v)} placeholder="0,00" /></div>
                <button onClick={() => tiraIng(i.id)} disabled={ingredientes.length <= 1} title="Tirar"
                  style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0, cursor: ingredientes.length <= 1 ? 'default' : 'pointer',
                    border: `1px solid ${C.line}`, background: 'transparent', color: ingredientes.length <= 1 ? C.faint : C.red,
                    fontSize: 15, fontWeight: 800, opacity: ingredientes.length <= 1 ? 0.35 : 1, lineHeight: 1,
                  }}>×</button>
              </div>
            ))}
            <div style={{ marginBottom: 14 }}><Btn kind="ghost" small onClick={addIng}>+ Adicionar ingrediente</Btn></div>
            <Field label="Rende quantas porções?"><NumInput value={rende} onChange={setRende} placeholder="ex.: 10" /></Field>
          </>
        )}

        <Field label="Embalagem por porção (se tiver)"><NumInput value={embalagem} onChange={setEmbalagem} placeholder="0,00" /></Field>
        <div style={{ marginBottom: 4 }}>
          <Label>Rateio de custo fixo por unidade (se quiser)</Label>
          <NumInput value={rateio} onChange={setRateio} placeholder="0,00" />
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 4, lineHeight: 1.45 }}>
            Salário, aluguel, luz e gás divididos por quantas unidades tu vende no mês. Pode deixar vazio — aí o preço
            cobre o ingrediente e a margem, e o fixo sai do bolo do mês.
          </div>

          {/* "MÃO DE OBRA NÃO SE PÕE TAMBÉM?"
              Na ficha não — a cozinheira ganha igual no sábado cheio e na
              terça parada, então não é custo DO prato. Mas a pergunta está
              certa no que importa: salário num bar pesa muito mais que luz e
              gás, e ignorar isso na hora de pôr preço é pior que ignorar a
              conta de energia. O lugar disso é este campo — e eu vinha
              mandando ela "preencher o rateio" sem nunca dizer com qual
              número. O sistema conhece as duas pontas; que ele faça a conta. */}
          {rateioAuto && rateioAuto.porUnidade > 0 && (
            <div style={{ background: C.panel2, borderRadius: 12, padding: '11px 14px', marginTop: 10 }}>
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
                Em <b style={{ color: C.text }}>{rateioAuto.rotulo}</b> tuas despesas de casa somaram{' '}
                <b style={{ color: C.text }}>{brl(rateioAuto.casa)}</b> e saíram{' '}
                <b style={{ color: C.text }}>{rateioAuto.unidades}</b> unidades. Dá{' '}
                <b style={{ color: C.accent }}>{brl(rateioAuto.porUnidade)}</b> de custo de casa em cada coisa que sai.
                {rateioAuto.maiores && rateioAuto.maiores.length > 0 && (
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>
                    O que mais pesou: {rateioAuto.maiores.map((m) => `${m.cat} ${brl(m.val)}`).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Btn kind="ghost" small onClick={() => setRateio(String(rateioAuto.porUnidade).replace('.', ','))}>
                  Usar {brl(rateioAuto.porUnidade)}
                </Btn>
                {num(rateio) > 0 && <Btn kind="ghost" small onClick={() => setRateio('')}>Tirar</Btn>}
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 9, lineHeight: 1.5 }}>
                É uma <b style={{ color: C.muted }}>média por cabeça</b>: um chopp e um camarão não dão o mesmo trabalho
                pra cozinha, e aqui levam a mesma fatia. Grosseiro — mas muito melhor que tratar o salário como se não
                existisse.
              </div>
            </div>
          )}
          {rateioAuto && !rateioAuto.porUnidade && (
            <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.5 }}>
              Eu calcularia esse número sozinho a partir de {rateioAuto.rotulo}, mas ainda falta{' '}
              {rateioAuto.falta === 'despesas' ? 'lançar as despesas de casa daquele mês' : 'venda de comanda naquele mês'}.
            </div>
          )}
        </div>

        {custo.pronto && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: C.muted }}>Custo de uma unidade</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: C.amber, fontVariantNumeric: 'tabular-nums' }}>{brl(custo.valor)}</span>
          </div>
        )}
      </Card>

      {/* 2 — O QUE SAI DE CADA VENDA */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: C.accent, fontWeight: 700, marginBottom: 4 }}>
          2 · O que sai a cada venda
        </div>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 14, lineHeight: 1.45 }}>
          Tudo que é cobrado <b style={{ color: C.muted }}>em cima do preço</b>, em %. Fica guardado — é igual pra todo
          produto, tu só preenche uma vez.
        </div>
        {campoPct('impostos', 'Impostos (% da venda)', 'No MEI costuma ser fixo no mês; aí pode deixar 0 e tratar o DAS como despesa.', 'ex.: 6')}
        {campoPct('cartao', 'Taxa média do cartão', 'A média entre débito, crédito e Pix. Está no teu extrato da maquininha.', 'ex.: 3,5')}
        {campoPct('comissao', 'Comissão de venda', 'Se o atendimento ganha % em cima do que vende.', '0')}
        {campoPct('delivery', 'Delivery / marketplace', 'O que o aplicativo fica de cada pedido.', '0')}
        {conta.taxasPct > 0 && (
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, paddingTop: 10, borderTop: `1px solid ${C.line}`, lineHeight: 1.5 }}>
            De cada R$ 100 que entram, <b style={{ color: C.text }}>R$ {conta.taxasPct.toFixed(2).replace('.', ',')}</b> já saem
            antes de qualquer coisa.
          </div>
        )}
      </Card>

      {/* 3 — QUANTO ELA QUER GANHAR */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: C.accent, fontWeight: 700, marginBottom: 4 }}>
          3 · Quanto tu quer ganhar
        </div>
        <div style={{ fontSize: 12, color: C.faint, marginBottom: 14, lineHeight: 1.45 }}>
          Tua margem, contada <b style={{ color: C.muted }}>em cima do preço de venda</b>.
        </div>
        {campoPct('margem', 'Margem de lucro desejada', '', 'ex.: 65')}

        {/* O NÚMERO QUE SE PÕE AQUI NÃO É O MESMO DE UMA LOJA — e eu quase a
            fiz errar isso.
            O exemplo era "25", copiado das calculadoras de varejo. Lá o custo
            é a mercadoria pronta, e 25% em cima dela fecha a conta. Aqui o
            custo é só o INGREDIENTE: aluguel, salário, luz e gás não estão
            nele. Pôr 25 numa porção que custa R$ 8 de ingrediente dá preço de
            R$ 11 — ingrediente comendo 72% da venda, quando o saudável em bar
            é abaixo de 35%. Ela estaria vendendo no prejuízo com a tela
            dizendo "25% de lucro". */}
        <div style={{ background: C.panel2, borderRadius: 12, padding: '11px 14px', fontSize: 12, color: C.muted, lineHeight: 1.55, marginBottom: 10 }}>
          <b style={{ color: C.amber }}>Cuidado com o número aqui.</b> Se tu deixou o rateio de custo fixo vazio, esta
          margem é tudo que sobra depois do <b style={{ color: C.text }}>ingrediente</b> — e dela ainda saem aluguel,
          salário, luz, gás e o teu lucro. Em bar e cozinha, o normal é pedir
          entre <b style={{ color: C.text }}>60% e 70%</b> aqui. Os 25% que as calculadoras de loja sugerem valem pra
          revenda, onde o custo já é o produto pronto.
        </div>
        <div style={{ background: C.panel2, borderRadius: 12, padding: '11px 14px', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
          <b style={{ color: C.text }}>Margem não é markup.</b> Margem é quanto sobra pra ti de cada R$ 100 vendidos.
          Markup é o número que tu multiplica no custo pra chegar no preço. Esta conta usa a margem sobre a venda —
          é a que não engana, porque imposto e cartão também são cobrados em cima do preço, não do custo.
        </div>
      </Card>

      {/* O RESULTADO */}
      <Card style={{ marginBottom: 14, borderColor: conta.estado === 'ok' ? C.green : C.cardBorder }}>
        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted, fontWeight: 800, marginBottom: 6 }}>
          Preço de venda sugerido
        </div>

        {conta.estado === 'impossivel' ? (
          // NÃO EXISTE ESSE PREÇO, e dizer isso é melhor que mostrar um número.
          // Taxas + margem passando de 100% é pedir pra sobrar mais do que entra.
          <div style={{ fontSize: 13.5, color: C.red, lineHeight: 1.6, fontWeight: 600 }}>
            Não existe preço que feche assim. As taxas ({conta.taxasPct.toFixed(1).replace('.', ',')}%) mais a margem que
            tu pediu ({conta.margemPct.toFixed(1).replace('.', ',')}%) somam {conta.soma.toFixed(1).replace('.', ',')}% —
            mais do que o total da venda. Baixa a margem pra menos de {(100 - conta.taxasPct).toFixed(0)}%.
          </div>
        ) : conta.estado !== 'ok' ? (
          <Empty>
            {conta.estado === 'sem-margem'
              ? 'Falta dizer quanto tu quer ganhar, ali no passo 3.'
              : custo.motivo === 'escolhe' ? 'Escolhe o produto ali em cima.'
                : custo.motivo === 'sem-ingrediente' ? 'Põe os ingredientes e o valor de cada um.'
                  : custo.motivo === 'sem-rendimento' ? 'Falta dizer quantas porções a receita rende.'
                    : 'Falta o custo do produto.'}
          </Empty>
        ) : (
          <>
            <div style={{ fontSize: 40, fontWeight: 900, color: C.green, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
              {brl(conta.sugerido)}
            </div>
            <div style={{ fontSize: 12.5, color: C.faint, marginTop: 5, lineHeight: 1.5 }}>
              A conta exata deu {brl(conta.preco)} — arredondei <b style={{ color: C.muted }}>pra cima</b>, no meio real,
              que é como se cobra. Assim tu nunca fica abaixo do que pediu: dá{' '}
              <b style={{ color: C.text }}>{conta.margemNoSugerido.toFixed(1).replace('.', ',')}%</b> de margem,{' '}
              <b style={{ color: C.text }}>{brl(conta.lucroNoSugerido)}</b> no teu bolso por unidade.
            </div>

            {/* PRA ONDE VAI CADA R$ 1,00 */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.muted, marginBottom: 8 }}>Pra onde vai cada R$ 1,00 que entra</div>
              <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: C.panel2 }}>
                {fatias.map(([nome, v, cor]) => (
                  <div key={nome} title={`${nome}: ${v.toFixed(1)}%`} style={{ width: `${v}%`, background: cor }} />
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                {fatias.map(([nome, v, cor]) => (
                  <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: cor, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text }}>{nome}</span>
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {brl(conta.preco * (v / 100))} · {v.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
              <span style={{ color: C.muted }}>Markup (quanto é o custo multiplicado)</span>
              <b style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{conta.markup.toFixed(2).replace('.', ',')}×</b>
            </div>

            {/* O MESMO NÚMERO QUE O RELATÓRIO CHAMA DE CMV.
                Aqui ele aparece ANTES de o preço existir, que é quando ainda
                dá pra mudar. Se o ingrediente ficar acima de 35% do preço, o
                mês fecha com CMV ruim — e aí já foi. Mesma régua dos dois
                lados do sistema, de propósito: dois números com o mesmo nome
                e faixas diferentes seria pior que não ter nenhum. */}
            {custoPct != null && (
              <div style={{ fontSize: 12, color: C.faint, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, lineHeight: 1.55 }}>
                Nesse preço, o ingrediente fica em <b style={{ color: custoPct >= CMV_ATENCAO ? C.red : custoPct >= CMV_BOM ? C.amber : C.green }}>{custoPct.toFixed(0)}% da venda</b>
                {' '}— é o que o relatório chama de <b style={{ color: C.muted }}>CMV</b>.{' '}
                {custoPct >= CMV_ATENCAO
                  ? <>Em bar, acima de {CMV_ATENCAO}% quase sempre é preço defasado. <b style={{ color: C.text }}>Pede mais margem</b> ali em cima.</>
                  : custoPct >= CMV_BOM
                    ? <>Em bar, o confortável é abaixo de {CMV_BOM}%. Dá pra apertar um pouco mais a margem.</>
                    : <>Em bar, abaixo de {CMV_BOM}% é faixa tranquila.</>}
              </div>
            )}
          </>
        )}
      </Card>

      {/* O CONFRONTO COM O PREÇO DE HOJE — o que nenhuma calculadora da
          internet consegue fazer, porque ela não sabe quanto tu cobra. */}
      {conta.estado === 'ok' && hoje && (
        <Card style={{ marginBottom: 14, borderColor: hoje.preco < conta.sugerido ? C.amber : C.green }}>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.1em', color: hoje.preco < conta.sugerido ? C.amber : C.green, fontWeight: 800, marginBottom: 8 }}>
            E o preço que tu cobra hoje?
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['Hoje tu cobra', brl(hoje.preco), C.text], ['Que dá de margem', `${hoje.margem.toFixed(1).replace('.', ',')}%`, hoje.margem < 0 ? C.red : hoje.margem < conta.margemPct ? C.amber : C.green], ['No teu bolso', brl(hoje.lucro), hoje.lucro < 0 ? C.red : C.text]].map(([rot, v, cor]) => (
              <div key={rot} style={{ flex: '1 1 110px', background: C.panel2, borderRadius: 11, padding: '9px 11px', minWidth: 0 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: C.faint, fontWeight: 800 }}>{rot}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: cor, marginTop: 3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
            {hoje.lucro < 0 ? (
              <>Cada <b>{item.nome}</b> que sai te custa <b style={{ color: C.red }}>{brl(Math.abs(hoje.lucro))}</b> do
              teu bolso. Vender mais só aumenta o buraco — esse preço precisa subir.</>
            ) : hoje.preco < conta.sugerido ? (
              // "EM 100 UNIDADES SÃO R$ X" TEM UMA SUPOSIÇÃO ESCONDIDA: que ela
              // vai vender as mesmas 100 depois de subir o preço. Num aumento
              // de R$ 2 isso é quase verdade. Num combo de R$ 399,99 que ia pra
              // R$ 529,50 — 32% a mais — não é: quantidade cai quando o preço
              // sobe, e o quanto cai nenhuma conta aqui sabe.
              //
              // Número que parece certo e depende de suposição não dita é do
              // mesmo tipo dos que eu já consertei neste sistema. Então a
              // suposição passa a vir escrita, e quanto maior o salto, mais
              // forte o aviso.
              <>Tu está deixando <b style={{ color: C.amber }}>{brl(conta.lucroNoSugerido - hoje.lucro)}</b> na mesa
              em cada <b>{item.nome}</b>. Em 100 unidades no mês,
              são <b style={{ color: C.amber }}>{brl((conta.lucroNoSugerido - hoje.lucro) * 100)}</b>
              {' '}— <span style={{ color: C.muted }}>se continuar vendendo o mesmo tanto</span>.
              {saltoPct >= 12 && (
                <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
                  <b style={{ color: C.amber }}>Mas olha o tamanho do salto:</b> de {brl(hoje.preco)} pra {brl(conta.sugerido)}
                  {' '}é <b style={{ color: C.text }}>{saltoPct.toFixed(0)}% mais caro</b>. Aumento desse tamanho mexe na
                  quantidade que sai, e aí as 100 unidades podem virar 70.{' '}
                  {saltoPct >= 25
                    ? <>Nesse caso vale subir <b style={{ color: C.text }}>aos poucos</b> e olhar o que acontece com a
                      venda, em vez de dar o salto inteiro de uma vez.</>
                    : <>Vale subir e acompanhar se a saída se mantém.</>}
                  {' '}Em <b style={{ color: C.text }}>combo</b> isso é ainda mais delicado: ele costuma ter margem menor
                  de propósito, porque o trabalho dele é <b style={{ color: C.text }}>vender mais</b>. Quem decide se
                  valeu é o lucro do mês inteiro, não o de uma unidade — isso está em{' '}
                  <b style={{ color: C.text }}>Margem → quem mais deu no mês</b>.
                </div>
              )}</>
            ) : (
              // O risco aqui é ela ler o número grande lá em cima como "o preço
              // certo" e baixar o dela. O sugerido é PISO: o mínimo pra a
              // margem pedida. Cobrar mais que o piso é o objetivo do negócio.
              <>O {brl(conta.sugerido)} ali em cima é o <b style={{ color: C.text }}>mínimo</b> pra margem que tu pediu —
              não é o preço que tu deve cobrar. Tu cobra {brl(hoje.preco)}, que dá{' '}
              <b style={{ color: C.green }}>{hoje.margem.toFixed(0)}%</b>: bem melhor.
              <b style={{ color: C.green }}> Não baixa.</b> Esse é um item que banca os que rendem pouco.</>
            )}
          </div>

          {/* Fechar o ciclo: mudar o preço sem ter que ir até o Cardápio e
              digitar de novo. Em dois toques, de propósito — é o preço que o
              atendimento vai cobrar do cliente, não dá pra mudar por esbarrão. */}
          {/* O BOTÃO SÓ PODE OFERECER O QUE MELHORA — e aqui eu tinha errado.
              Na batata dela: custo R$ 3,22, sugerido R$ 10,50, e ela cobra
              R$ 29,99 (uma margem ótima). A tela dizia "não precisa mexer" e
              logo abaixo oferecia "Pôr R$ 10,50 no cardápio" — um toque pra
              jogar fora R$ 18,88 por porção.
              O preço sugerido é um PISO, o mínimo pra a margem que ela pediu;
              não é alvo nem teto. Quando ela já cobra mais, baixar é decisão
              dela e tem que parecer o que é: uma redução, com o tamanho da
              perda escrito. Nunca o caminho fácil. */}
          {onCardapio && hoje.preco !== conta.sugerido && (() => {
            const baixando = conta.sugerido < hoje.preco;
            const perda = Math.round((hoje.lucro - conta.lucroNoSugerido) * 100) / 100;
            return (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                {aplicado ? (
                  <div style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>
                    ✓ {item.nome} agora está {brl(num(aplicado))} no cardápio.
                  </div>
                ) : confirmando ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 700, width: '100%', marginBottom: 4, lineHeight: 1.55 }}>
                      {baixando ? (
                        <>Tens certeza? Isso <b style={{ color: C.red }}>baixa</b> {item.nome} de {brl(hoje.preco)} pra{' '}
                        {brl(conta.sugerido)} — tu passa a ganhar <b style={{ color: C.red }}>{brl(perda)} a menos</b> em
                        cada uma. O sugerido é o <b>mínimo</b> pra margem que tu pediu, não o preço que tu deve cobrar.</>
                      ) : (
                        <>Trocar o preço de {item.nome} de {brl(hoje.preco)} pra {brl(conta.sugerido)}? O atendimento
                        passa a cobrar esse valor.</>
                      )}
                    </span>
                    <Btn kind={baixando ? 'danger' : 'ok'} small onClick={aplicarNoCardapio}>
                      {baixando ? `Sim, baixar pra ${brl(conta.sugerido)}` : 'Sim, trocar'}
                    </Btn>
                    <Btn kind="ghost" small onClick={() => setConfirmando(false)}>Agora não</Btn>
                  </div>
                ) : baixando ? (
                  // Discreto de propósito: é uma saída, não uma sugestão.
                  <button onClick={() => setConfirmando(true)} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: 0, textAlign: 'left', lineHeight: 1.5 }}>
                    se tu quiser mesmo assim, dá pra baixar pra {brl(conta.sugerido)} — mas tu perde {brl(perda)} por unidade
                  </button>
                ) : (
                  <Btn kind="ghost" small onClick={() => setConfirmando(true)}>Pôr {brl(conta.sugerido)} no cardápio</Btn>
                )}
              </div>
            );
          })()}
        </Card>
      )}
    </div>
  );
}
