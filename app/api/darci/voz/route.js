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

export async function GET() {
  if (!ehDona()) return NextResponse.json({ ok: false, erro: 'Não autorizado.' }, { status: 401 });
  const m = motor();
  return NextResponse.json({ ok: true, disponivel: !!m, motor: m });
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
