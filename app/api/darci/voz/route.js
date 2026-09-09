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
// Aceita dois serviços — vale o que tiver chave:
//   ELEVENLABS_API_KEY  (+ ELEVENLABS_VOICE_ID)  → voz que dá pra desenhar
//   OPENAI_API_KEY      (+ OPENAI_TTS_VOICE)     → mais simples e barato
const LIMITE = 900; // caracteres por fala — trava de gasto, o Darci é breve

function motor() {
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
    if (m === 'elevenlabs') {
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
      r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
          voice: process.env.OPENAI_TTS_VOICE || 'onyx',
          input: texto,
          response_format: 'mp3',
        }),
      });
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
