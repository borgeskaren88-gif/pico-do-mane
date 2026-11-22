import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, opcoesDoCracha, valorSessaoValida, consoleLigado } from '../../../lib/auth';
import { lerNegocios, criarNegocio, lerConfigVenda } from '../../../lib/negocios';
import { bancoDo, bancoAdmin } from '../../../lib/banco';
import { definirSenhaDona } from '../../../lib/senha';
import { assinaturaNova, codigoLivre, TESTE_DIAS } from '../../../lib/assinatura';

export const dynamic = 'force-dynamic';

// "CRIAR MEU BAR" — o cadastro que não passa pela Karen.
//
// A pessoa viu o QR code, abriu a página, gostou. Aqui ela põe o nome do bar,
// o nome dela, o WhatsApp e uma senha — e sai daqui JÁ DENTRO do app dela, com
// 14 dias de teste. O código pra entrar sai do nome do bar ("Boteco da Ana" ->
// boteco-da-ana) e aparece na tela pra ela guardar.
//
// Endereço aberto pra internet inteira, então três cuidados:
//   1. só existe no app de muitos (onde há sala de máquinas) e com o cadastro
//      aberto — a Karen pode fechar lá;
//   2. um campo escondido que gente não vê e robô preenche;
//   3. limite: 3 cadastros por aparelho/rede por dia e 40 no total por dia.
//      Robô que passar disso não enche o banco de bar de mentira.

const DIA = 24 * 60 * 60 * 1000;
const CHAVE_LIMITE = 'cadastrosRecentes';

async function dentroDoLimite(ipHash) {
  const sb = bancoAdmin();
  const { data } = await sb.from('pdm_dados').select('valor').eq('chave', CHAVE_LIMITE).maybeSingle();
  const agora = Date.now();
  const lista = (Array.isArray(data?.valor?.lista) ? data.valor.lista : []).filter((x) => x && agora - Number(x.em) < DIA);
  if (lista.length >= 40) return { ok: false, lista };
  if (lista.filter((x) => x.ip === ipHash).length >= 3) return { ok: false, lista };
  return { ok: true, lista };
}
async function anotar(lista, ipHash) {
  await bancoAdmin().from('pdm_dados').upsert(
    { chave: CHAVE_LIMITE, valor: { lista: [...lista, { ip: ipHash, em: Date.now() }].slice(-80) }, atualizado_em: new Date().toISOString() },
    { onConflict: 'chave' },
  );
}

const erro = (msg, status = 400) => NextResponse.json({ ok: false, erro: msg }, { status });

// O que a página precisa saber antes de mostrar o formulário: se o cadastro
// está aberto e quanto custa depois do teste.
export async function GET() {
  if (!consoleLigado()) return erro('Não encontrado.', 404);
  const cfg = await lerConfigVenda().catch(() => ({ preco: 99.9, cadastroAberto: true }));
  return NextResponse.json({ ok: true, aberto: cfg.cadastroAberto, preco: cfg.preco, testeDias: TESTE_DIAS });
}

export async function POST(request) {
  if (!consoleLigado()) return erro('Não encontrado.', 404);
  let b = {};
  try { b = await request.json(); } catch { return erro('Requisição inválida.'); }

  // O campo escondido. Gente não vê, então não preenche.
  if (String(b.site || '').trim()) return erro('Não deu certo. Tenta de novo.');

  const nomeBar = String(b.nomeBar || '').trim().slice(0, 60);
  const cidade = String(b.cidade || '').trim().slice(0, 60);
  const dona = String(b.dona || '').trim().slice(0, 60);
  const whatsapp = String(b.whatsapp || '').replace(/\D/g, '');
  const email = String(b.email || '').trim().toLowerCase().slice(0, 90);
  const senha = String(b.senha || '');

  if (nomeBar.length < 2) return erro('Escreve o nome do negócio.');
  if (dona.length < 2) return erro('Escreve o teu nome.');
  if (whatsapp.length < 10 || whatsapp.length > 13) return erro('O WhatsApp precisa do DDD. Ex: 48 99999-9999.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro('Esse e-mail não parece certo.');
  if (senha.length < 6) return erro('A senha precisa de pelo menos 6 letras ou números.');
  if (b.aceite !== true) return erro('Marca que leste e concordas com o teste e a mensalidade.');

  const cfg = await lerConfigVenda().catch(() => ({ cadastroAberto: true }));
  if (!cfg.cadastroAberto) return erro('O cadastro está fechado agora. Fala com a gente pelo WhatsApp.', 403);

  const h = headers();
  const ip = String(h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim() || 'sem-ip';
  const ipHash = crypto.createHash('sha256').update('cadastro:' + (process.env.SESSION_SECRET || '') + ':' + ip).digest('hex').slice(0, 16);
  const lim = await dentroDoLimite(ipHash);
  if (!lim.ok) return erro('Muitos cadastros daqui hoje. Tenta amanhã ou fala com a gente pelo WhatsApp.', 429);

  let codigo = '';
  try {
    // Duas pessoas cadastrando "Bar do Zé" no mesmo segundo: a segunda pega o
    // "-2". Se mesmo assim bater, tenta de novo com a lista relida.
    for (let tentativa = 0; tentativa < 3 && !codigo; tentativa += 1) {
      const c = codigoLivre(nomeBar, Object.keys(await lerNegocios()));
      try {
        await criarNegocio({
          codigo: c, nome: nomeBar,
          assinatura: { ...assinaturaNova(), origem: 'cadastro' },
          contato: { nome: dona, whatsapp: whatsapp.length <= 11 ? '55' + whatsapp : whatsapp, email, cidade },
        });
        codigo = c;
      } catch (e) {
        if (!/Já existe/.test(String(e?.message))) throw e;
      }
    }
    if (!codigo) return erro('Não consegui criar agora. Tenta de novo em um minuto.', 500);

    const sb = bancoDo(codigo);
    await definirSenhaDona(sb, senha);
    // O app já nasce com o nome do bar e o dela: a primeira tela é o bar dela,
    // não um formulário pedindo de novo o que ela acabou de escrever.
    await sb.from('pdm_dados').upsert(
      { chave: 'painel', valor: { negocio: { nome: nomeBar, cidade, dona, papeis: {} } }, atualizado_em: new Date().toISOString() },
      { onConflict: 'chave' },
    );
    await anotar(lim.lista, ipHash);
  } catch (e) {
    return erro(e?.message || 'Não deu certo.', 500);
  }

  // Já sai logada como dona do bar novo. No celular fica lembrado (como no
  // login normal); no computador vale enquanto o navegador estiver aberto.
  const ua = String(h.get('user-agent') || '');
  const celular = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  cookies().set(nomeCookie(), valorSessaoValida(codigo), opcoesDoCracha(celular));
  return NextResponse.json({ ok: true, codigo, nome: nomeBar, testeDias: TESTE_DIAS });
}
