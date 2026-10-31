import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../lib/auth';
import { bancoDaSessao } from '../../../lib/negocioAtual';

export const dynamic = 'force-dynamic';

// A GALERIA DE FICHAS TÉCNICAS EM PDF.
//
// "Preciso de um lugar onde eu coloque as fichas técnicas, tipo uma galeria —
// eu já tenho tudo salvo em PDF."
//
// Ela já tinha o trabalho feito; o que faltava era o trabalho estar no bar. Em
// PDF no celular dela, a ficha só existe quando ela está presente — e ficha
// técnica serve justamente pra quando ela NÃO está.
//
// O ARQUIVO NÃO ENTRA NO PAINEL, de jeito nenhum. O painel é lido inteiro toda
// vez que o app abre; meia dúzia de PDFs ali dentro faria o bar esperar
// megabytes pra desenhar a tela de entrada. O arquivo vai pro depósito do
// Supabase e aqui fica só a etiqueta: nome, caminho, tipo, tamanho.
//
// QUEM VÊ E QUEM MEXE são coisas diferentes, e ela escolheu assim: a cozinha
// abre as fichas durante o serviço, mas quem acrescenta e apaga é a dona. Uma
// ficha apagada no meio do sábado não tem como voltar.
const PREFIXO = 'fichaarq:';
const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};
// Uma hora: tempo de sobra pra abrir e reabrir durante um serviço, e curto o
// bastante pra um link copiado não virar porta de entrada permanente.
const VALIDADE = 60 * 60;

const papel = () => papelDaSessao(cookies().get(nomeCookie())?.value);
const podeVer = (p) => p === 'dona' || p === 'cozinha';
const podeMexer = (p) => p === 'dona';
const txt = (v, max) => String(v == null ? '' : v).slice(0, max).trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const naoAutorizado = () => NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });

async function listar(sb) {
  const { data, error } = await sb.from('pdm_dados').select('valor').like('chave', `${PREFIXO}%`);
  if (error) throw error;
  return (data || [])
    .map((r) => r.valor)
    .filter((f) => f && f.id && f.caminho)
    .sort((a, b) => txt(a.nome, 200).localeCompare(txt(b.nome, 200), 'pt-BR', { sensitivity: 'base' }));
}

export async function GET() {
  const p = papel();
  if (!podeVer(p)) return naoAutorizado();
  try {
    const sb = bancoDaSessao();
    const fichas = await listar(sb);
    if (!fichas.length) return NextResponse.json({ ok: true, fichas: [], podeMexer: podeMexer(p) });
    // Um pedido só pra assinar todas: assinar uma a uma faria a galeria abrir
    // em N idas ao servidor, e no 4G do bar isso se sente.
    let urls = [];
    try {
      const r = await sb.arquivos().assinarVarios(fichas.map((f) => f.caminho), VALIDADE);
      urls = Array.isArray(r?.data) ? r.data : [];
    } catch { /* sem link: a galeria mostra o nome e avisa que não abriu */ }
    // O depósito devolve os links na MESMA ORDEM dos caminhos pedidos. Casar
    // pelo texto do caminho seria mais frágil, porque ele volta com a pasta do
    // negócio na frente e a etiqueta guarda só o pedaço de dentro.
    const comUrl = fichas.map((f, i) => ({ ...f, url: txt(urls[i] && urls[i].signedUrl, 2000) }));
    return NextResponse.json({ ok: true, fichas: comUrl, podeMexer: podeMexer(p) });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao carregar as fichas.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!podeMexer(papel())) return naoAutorizado();
  try {
    const form = await request.formData();
    const arquivo = form.get('arquivo');
    if (!arquivo || typeof arquivo === 'string' || typeof arquivo.arrayBuffer !== 'function') {
      return NextResponse.json({ ok: false, erro: 'Nenhum arquivo chegou.' }, { status: 400 });
    }
    const tipo = txt(arquivo.type, 100).toLowerCase();
    const ext = TIPOS[tipo];
    if (!ext) {
      return NextResponse.json({ ok: false, erro: 'Só entra PDF ou foto (JPG, PNG, WEBP).' }, { status: 400 });
    }
    const bytes = Number(arquivo.size) || 0;
    if (bytes <= 0) return NextResponse.json({ ok: false, erro: 'O arquivo chegou vazio.' }, { status: 400 });
    if (bytes > MAX_BYTES) {
      return NextResponse.json({ ok: false, erro: `Arquivo grande demais (máximo ${Math.round(MAX_BYTES / 1024 / 1024)} MB).` }, { status: 400 });
    }

    // O nome que ela vê é o nome do prato, não "ficha_final_v3.pdf". Se ela não
    // escrever nada, vale o nome do arquivo sem a extensão — já costuma ser o
    // nome do prato.
    const semExt = txt(arquivo.name, 160).replace(/\.[a-z0-9]{1,6}$/i, '');
    const nome = txt(form.get('nome'), 120) || semExt || 'Ficha sem nome';

    const sb = bancoDaSessao();
    const arq = sb.arquivos();
    await arq.garantirBalde();

    const id = uid();
    const caminho = `fichas/${id}.${ext}`;
    const corpo = Buffer.from(await arquivo.arrayBuffer());
    const { error: errUp } = await arq.subir(caminho, corpo, tipo);
    if (errUp) throw errUp;

    const ficha = { id, nome, caminho, tipo, tamanho: bytes, criadoEm: new Date().toISOString() };
    // A etiqueta só entra DEPOIS do arquivo subir. Na ordem contrária, uma
    // falha de upload deixaria na galeria um cartão que não abre nunca.
    const { error } = await sb.from('pdm_dados').upsert([{ chave: PREFIXO + id, valor: ficha }]);
    if (error) throw error;
    return NextResponse.json({ ok: true, ficha });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao guardar a ficha.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!podeMexer(papel())) return naoAutorizado();
  try {
    const corpo = await request.json();
    const id = txt(corpo && corpo.id, 40);
    const nome = txt(corpo && corpo.nome, 120);
    if (!id || !nome) return NextResponse.json({ ok: false, erro: 'Faltou o nome.' }, { status: 400 });
    const sb = bancoDaSessao();
    const { data, error: errLer } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id);
    if (errLer) throw errLer;
    const atual = (data || [])[0]?.valor;
    if (!atual) return NextResponse.json({ ok: false, erro: 'Ficha não encontrada.' }, { status: 404 });
    const { error } = await sb.from('pdm_dados').upsert([{ chave: PREFIXO + id, valor: { ...atual, nome } }]);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao renomear.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!podeMexer(papel())) return naoAutorizado();
  try {
    const id = txt(new URL(request.url).searchParams.get('id'), 40);
    if (!id) return NextResponse.json({ ok: false, erro: 'Faltou dizer qual ficha.' }, { status: 400 });
    const sb = bancoDaSessao();
    const { data, error: errLer } = await sb.from('pdm_dados').select('valor').eq('chave', PREFIXO + id);
    if (errLer) throw errLer;
    const ficha = (data || [])[0]?.valor;
    if (!ficha) return NextResponse.json({ ok: false, erro: 'Ficha não encontrada.' }, { status: 404 });

    // O arquivo sai primeiro. Se a etiqueta saísse antes e o arquivo falhasse,
    // o PDF ficaria no depósito pra sempre, sem ninguém sabendo que está lá.
    try { await sb.arquivos().apagar(ficha.caminho); } catch { /* segue e tira a etiqueta */ }
    const { error } = await sb.from('pdm_dados').delete().eq('chave', PREFIXO + id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Erro ao apagar.' }, { status: 500 });
  }
}
