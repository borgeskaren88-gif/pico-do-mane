import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { nomeCookie, papelDaSessao } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// A voz exclusiva do Darci. Em vez da voz de fábrica do aparelho (que no iPhone
// é sempre feminina e lê o português torto), o texto vai pra um serviço de voz
// e volta um áudio de verdade — a MESMA voz no celular, no iPad e no notebook.
//
// A chave fica só aqui no servidor (variável de ambiente na Vercel). Ela nunca
// chega no navegador. Se não houver chave nenhuma, o app avisa que a voz
// exclusiva está desligada e continua usando a voz do aparelho.
//
// Aceita três serviços — vale o que tiver chave, nesta ordem:
//   AZURE_SPEECH_KEY    (+ AZURE_SPEECH_REGION, AZURE_SPEECH_VOICE)
//        → as MESMAS vozes "Natural" da Microsoft que aparecem no Edge do
//          notebook (Antônio, Francisca…), agora em qualquer aparelho.
//   ELEVENLABS_API_KEY  (+ ELEVENLABS_VOICE_ID)  → voz que dá pra desenhar
//   OPENAI_API_KEY      (+ OPENAI_TTS_VOICE)     → mais simples e barato
const LIMITE = 900; // caracteres por fala — trava de gasto, o Darci é breve

// Escapa o que não pode ir cru dentro do XML da Microsoft.
const xml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function motor() {
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) return 'azure';
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

const ehDona = () => papelDaSessao(cookies().get(nomeCookie())?.value) === 'dona';

// Quem está respondendo e o que enxerga. Mesma história da IA: o repositório
// está ligado a mais de um projeto na Vercel, e dá pra salvar a chave num e
// usar o site do outro sem nenhuma pista do motivo.
const ondeEstou = () => ({
  publicacao: process.env.VERCEL_URL || 'rodando fora da Vercel',
  temAzure: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
  azureSoChave: !!(process.env.AZURE_SPEECH_KEY && !process.env.AZURE_SPEECH_REGION),
  temEleven: !!process.env.ELEVENLABS_API_KEY,
  temOpenai: !!process.env.OPENAI_API_KEY,
  regiao: process.env.AZURE_SPEECH_REGION || '',
  voz: process.env.AZURE_SPEECH_VOICE || (process.env.AZURE_SPEECH_KEY ? 'pt-BR-AntonioNeural' : ''),
});

// Traduz a recusa do serviço de voz pro que ela precisa FAZER.
function explicarVoz(status, detalhe, m) {
  if (status === 0) {
    // Região escrita errada não dá erro HTTP: o endereço simplesmente não
    // existe. É de longe o erro mais comum de quem configura o Azure.
    if (m === 'azure') return 'Não existe servidor com essa região. A região tem que ser o código curto, tudo junto e minúsculo — por exemplo "brazilsouth", e não "Brazil South".';
    return 'Não consegui alcançar o serviço de voz.';
  }
  if (status === 401 || status === 403) return 'A chave da voz foi recusada. Confere se colou ela inteira e se é a chave do serviço de fala.';
  if (status === 404) return m === 'azure' ? 'A região não bate com a da chave. As duas têm que ser do mesmo recurso do Azure.' : 'O serviço não encontrou o que pedi.';
  if (status === 400) return 'O serviço recusou o pedido — normalmente é o nome da voz escrito errado.';
  if (status === 429) return 'Passou da cota de fala do mês, ou muita fala de uma vez. Confere o plano no painel do serviço.';
  if (status >= 500) return 'O serviço de voz está fora do ar agora. Não é coisa tua.';
  return `O serviço de voz respondeu com erro ${status}.`;
}

// A chamada ao serviço de voz. O teste e a fala de verdade usam esta mesma
// função — senão o teste passaria e a fala falharia, que é o pior dos mundos.
async function falar(texto, m) {
  let r;
  if (m === 'azure') {
    const voz = process.env.AZURE_SPEECH_VOICE || 'pt-BR-AntonioNeural';
    const regiao = process.env.AZURE_SPEECH_REGION;
    const ssml = `<speak version='1.0' xml:lang='pt-BR'><voice name='${xml(voz)}'>${xml(texto)}</voice></speak>`;
    r = await fetch(`https://${encodeURIComponent(regiao)}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'PicoOS',
      },
      body: ssml,
    });
  } else if (m === 'elevenlabs') {
    const voz = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
    r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: texto,
        model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
      }),
    });
  } else {
    const voz = process.env.OPENAI_TTS_VOICE || 'onyx';
    const pedir = (modelo) => fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelo, voice: voz, input: texto, response_format: 'mp3' }),
    });
    // Tenta primeiro o modelo mais novo (fala melhor). Se a conta dela ainda
    // não tiver acesso a ele, cai no antigo, que existe pra todo mundo — em
    // vez de a dona ficar sem voz nenhuma sem entender por quê.
    const preferido = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
    r = await pedir(preferido);
    if (!r.ok && preferido !== 'tts-1') r = await pedir('tts-1');
  }
  return r;
}

export async function GET(request) {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  const m = motor();
  const onde = ondeEstou();
  // Só a pergunta "tem chave?" — é o que a tela usa pra decidir se mostra a
  // opção da voz exclusiva.
  if (!new URL(request.url).searchParams.get('teste')) {
    return NextResponse.json({ ok: true, disponivel: !!m, motor: m });
  }

  // O TESTE: fala de verdade uma frase curtinha e conta o que aconteceu.
  // Sem isto, chave errada = volta pra voz do aparelho, em silêncio, e ninguém
  // descobre por quê.
  if (!m) return NextResponse.json({ ok: false, semChave: true, onde });
  const t0 = Date.now();
  try {
    const r = await falar('Ó, Karen. É assim que eu falo.', m);
    if (!r.ok) {
      const detalhe = await r.text().catch(() => '');
      return NextResponse.json({
        ok: false, motor: m, onde, ms: Date.now() - t0,
        erro: explicarVoz(r.status, detalhe, m), cru: `HTTP ${r.status} · ${detalhe.slice(0, 250)}`,
      });
    }
    const audio = await r.arrayBuffer();
    return NextResponse.json({ ok: true, motor: m, onde, ms: Date.now() - t0, bytes: audio.byteLength });
  } catch (e) {
    const cru = String(e?.cause?.code || e?.message || e).slice(0, 250);
    return NextResponse.json({ ok: false, motor: m, onde, ms: Date.now() - t0, erro: explicarVoz(0, cru, m), cru });
  }
}

export async function POST(request) {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  const m = motor();
  if (!m) return NextResponse.json({ ok: false, erro: 'Voz exclusiva não configurada.' }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, erro: 'JSON inválido.' }, { status: 400 }); }
  const texto = String(body?.texto || '').slice(0, LIMITE).trim();
  if (!texto) return NextResponse.json({ ok: false, erro: 'Sem texto pra falar.' }, { status: 400 });

  try {
    const r = await falar(texto, m);
    if (!r.ok) {
      const detalhe = await r.text().catch(() => '');
      return NextResponse.json({ ok: false, erro: `O serviço de voz recusou (${r.status}).`, detalhe: detalhe.slice(0, 300) }, { status: 502 });
    }
    const audio = await r.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: e?.message || 'Não consegui gerar a voz.' }, { status: 500 });
  }
}
