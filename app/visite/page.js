// Site de visita (vitrine pública) do Pico do Mané.
// Rota pública em /visite — não passa pelo login do PicoOS.
// Os pontos marcados com "EDITAR:" são os que dependem de dados reais
// (endereço, telefone, @, fotos). Troque pelos valores do bar.

// ————————————————————————————————————————————————————————————————
// DADOS DO BAR — edite aqui e o site inteiro se atualiza.
// ————————————————————————————————————————————————————————————————
const BAR = {
  nome: 'Pico do Mané',
  tagline: 'Chopp gelado, petiscos e música ao vivo',
  descricao:
    'Um point pra chamar de seu: chopp sempre gelado, drinks bem feitos, ' +
    'petiscos de dar água na boca e a melhor energia pra ver o jogo, curtir ' +
    'a música ao vivo e ficar até tarde com quem é bom.',
  // EDITAR: a história de verdade do bar (como começou, de onde vem o nome,
  // o que faz o lugar ser especial). Deixei um texto de exemplo pra você ajustar.
  historia: [
    'O Pico do Mané nasceu da vontade de ter um canto de verdade no bairro — ' +
      'daqueles onde todo mundo se conhece, o chopp desce gelado e a noite ' +
      'sempre acaba melhor do que começou.',
    'Do pastel de camarão feito na hora à caipirinha caprichada, cada detalhe ' +
      'foi pensado pra você se sentir em casa. Com o tempo, viraram nossos os ' +
      'jogos no telão, as sextas de música ao vivo e a mesa que nunca quer ir embora.',
    'Mais do que um bar, o Pico é ponto de encontro. Chega mais.',
  ],
  // EDITAR: endereço real do bar
  endereco: 'Rua Exemplo, 123 — Bairro, Florianópolis/SC',
  // EDITAR: telefone/WhatsApp (só números, com DDI 55). Ex.: 5548999999999
  whatsapp: '5548999999999',
  // EDITAR: @ do Instagram (sem o @)
  instagram: 'picodomane',
  // EDITAR: horários reais
  horarios: [
    { dia: 'Segunda', hora: 'Fechado', fechado: true },
    { dia: 'Terça a Quinta', hora: '18h — 00h' },
    { dia: 'Sexta e Sábado', hora: '18h — 02h', destaque: true },
    { dia: 'Domingo', hora: '16h — 00h' },
  ],
};

const linkWhats = `https://wa.me/${BAR.whatsapp}?text=${encodeURIComponent('Olá! Vim pelo site do Pico do Mané 🍻')}`;
const linkInsta = `https://instagram.com/${BAR.instagram}`;
const linkMapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BAR.nome + ' ' + BAR.endereco)}`;

// Destaques do cardápio (edite à vontade)
const DESTAQUES = [
  { emoji: '🍺', nome: 'Chopp Gelado', desc: 'Puxado na medida certa, sempre gelado.' },
  { emoji: '🍹', nome: 'Caipirinhas & Drinks', desc: 'Caipirinha, Aperol, gin e a casa inteira de energéticos.' },
  { emoji: '🦐', nome: 'Pastéis de Camarão', desc: 'Recheados na hora — camarão e berbigão fresquinhos.' },
  { emoji: '🧀', nome: 'Porções & Pão de Alho', desc: 'Pra dividir na mesa e acompanhar o chopp.' },
  { emoji: '🎵', nome: 'Música ao Vivo', desc: 'Nas sextas, o caixa é ao vivo — som bom e clima de festa.' },
  { emoji: '⚽', nome: 'Todos os Jogos', desc: 'Telão ligado nos grandes jogos, com promoção rolando.' },
];

// Promoções recorrentes (edite à vontade)
const PROMOS = [
  { nome: 'Chopp em Dobro', quando: 'Pergunte o dia' },
  { nome: 'Caipirinha em Dobro', quando: 'Nos jogos' },
  { nome: 'Rosh em Dobro', quando: 'Terças' },
];

export const metadata = {
  title: 'Pico do Mané — Bar, Chopp & Petiscos',
  description:
    'Chopp gelado, drinks, petiscos, música ao vivo e todos os jogos no telão. Venha conhecer o Pico do Mané.',
  openGraph: {
    title: 'Pico do Mané — Bar, Chopp & Petiscos',
    description: 'Chopp gelado, drinks, petiscos e música ao vivo. Venha conhecer!',
    type: 'website',
  },
};

const css = `
  .pv * { box-sizing: border-box; margin: 0; padding: 0; }
  .pv {
    --bg: #15110C; --bg2: #1E1810; --card: #241D14; --line: #3A2F1F;
    --gold: #E7B24D; --gold2: #F5CC6E; --cream: #F6EEE0; --muted: #C3B199; --faint: #8A7A62;
    --coral: #E9765C;
    background: var(--bg); color: var(--cream);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.5; -webkit-font-smoothing: antialiased;
  }
  .pv a { color: inherit; text-decoration: none; }
  .pv .wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }

  /* NAV */
  .pv nav {
    position: sticky; top: 0; z-index: 20;
    padding: calc(12px + env(safe-area-inset-top)) 20px 12px;
    background: rgba(21,17,12,0.72); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .pv .brand { display: flex; align-items: center; gap: 10px; font-weight: 900; letter-spacing: .01em; }
  .pv .brand .mark {
    width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
    background: linear-gradient(135deg, var(--gold), var(--gold2));
    display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
  .pv .navlinks { display: flex; gap: 22px; font-size: 14px; font-weight: 600; color: var(--muted); }
  .pv .navlinks a:hover { color: var(--gold); }
  .pv .navcta {
    background: var(--gold); color: #241800; font-weight: 800; font-size: 13px;
    padding: 9px 16px; border-radius: 999px; white-space: nowrap;
  }
  @media (max-width: 720px) { .pv .navlinks { display: none; } }

  /* HERO */
  .pv .hero {
    position: relative; min-height: 82vh; display: flex; align-items: center;
    padding: 80px 0 64px;
    background:
      radial-gradient(900px 500px at 70% 10%, rgba(231,178,77,0.18), transparent 60%),
      linear-gradient(180deg, rgba(21,17,12,0.35) 0%, rgba(21,17,12,0.9) 85%, var(--bg) 100%),
      repeating-linear-gradient(135deg, #241D14 0 22px, #201A11 22px 44px);
    text-align: center;
  }
  .pv .hero .eyebrow {
    color: var(--gold); font-weight: 800; letter-spacing: .22em; text-transform: uppercase;
    font-size: 13px; margin-bottom: 18px;
  }
  .pv .hero h1 { font-size: clamp(44px, 11vw, 92px); font-weight: 900; line-height: 0.98; letter-spacing: -0.02em; }
  .pv .hero h1 span { color: var(--gold); display: block; }
  .pv .hero p.sub { color: var(--muted); font-size: clamp(16px, 2.4vw, 21px); margin: 20px auto 0; max-width: 620px; }
  .pv .cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 34px; }
  .pv .btn {
    padding: 14px 26px; border-radius: 999px; font-weight: 800; font-size: 15px;
    display: inline-flex; align-items: center; gap: 8px; cursor: pointer; border: 1px solid transparent;
    transition: transform .12s ease;
  }
  .pv .btn:hover { transform: translateY(-2px); }
  .pv .btn-gold { background: var(--gold); color: #241800; }
  .pv .btn-ghost { background: transparent; color: var(--cream); border-color: var(--line); }
  .pv .btn-whats { background: #25D366; color: #062b12; }

  /* SECTIONS */
  .pv section { padding: 74px 0; }
  .pv .kicker { color: var(--gold); font-weight: 800; letter-spacing: .16em; text-transform: uppercase; font-size: 13px; }
  .pv h2 { font-size: clamp(28px, 5vw, 40px); font-weight: 900; letter-spacing: -0.01em; margin-top: 8px; }
  .pv .lead { color: var(--muted); font-size: 18px; max-width: 640px; margin-top: 14px; }

  /* O PICO / HISTÓRIA */
  .pv .story { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 40px; align-items: center; }
  .pv .story-photo { aspect-ratio: 4/3; margin-top: 22px; }
  .pv .story-text p { color: var(--muted); font-size: 18px; margin-bottom: 18px; }
  .pv .story-text p:first-child { color: var(--cream); font-size: 21px; font-weight: 600; }
  @media (max-width: 760px) { .pv .story { grid-template-columns: 1fr; gap: 8px; } }

  /* DESTAQUES GRID */
  .pv .grid { display: grid; gap: 16px; margin-top: 36px; }
  .pv .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .pv .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 24px;
  }
  .pv .card .emoji { font-size: 32px; }
  .pv .card h3 { font-size: 19px; font-weight: 800; margin: 12px 0 6px; }
  .pv .card p { color: var(--muted); font-size: 15px; }
  @media (max-width: 860px) { .pv .grid-3 { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px) { .pv .grid-3 { grid-template-columns: 1fr; } }

  /* PROMOS */
  .pv .promos { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 30px; }
  .pv .promo {
    flex: 1 1 200px; background: linear-gradient(135deg, rgba(231,178,77,0.16), rgba(231,178,77,0.04));
    border: 1px solid rgba(231,178,77,0.35); border-radius: 16px; padding: 20px;
  }
  .pv .promo .tag { color: var(--gold); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .pv .promo h3 { font-size: 22px; font-weight: 900; margin: 8px 0 4px; }
  .pv .promo p { color: var(--muted); font-size: 14px; }

  /* GALERIA */
  .pv .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 36px; }
  .pv .shot {
    aspect-ratio: 1/1; border-radius: 16px; border: 1px dashed var(--line);
    background: linear-gradient(135deg, #2A2115, #1C160E);
    display: flex; align-items: center; justify-content: center; text-align: center;
    color: var(--faint); font-size: 13px; font-weight: 600; padding: 12px;
  }
  .pv .shot span { font-size: 30px; display: block; margin-bottom: 8px; }
  @media (max-width: 560px) { .pv .gallery { grid-template-columns: 1fr 1fr; } }

  /* VISITE (info) */
  .pv .info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 36px; }
  .pv .panel { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 26px; }
  .pv .panel h3 { font-size: 15px; text-transform: uppercase; letter-spacing: .1em; color: var(--gold); font-weight: 800; margin-bottom: 16px; }
  .pv .hours { list-style: none; }
  .pv .hours li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 15px; }
  .pv .hours li:last-child { border-bottom: none; }
  .pv .hours .h-fechado { color: var(--faint); }
  .pv .hours .h-dest { color: var(--gold); font-weight: 700; }
  .pv .addr { font-size: 17px; line-height: 1.6; }
  .pv .addr .muted { color: var(--muted); font-size: 14px; }
  @media (max-width: 720px) { .pv .info { grid-template-columns: 1fr; } }

  /* FOOTER */
  .pv footer {
    border-top: 1px solid var(--line); padding: 48px 0 calc(40px + env(safe-area-inset-bottom));
    text-align: center; color: var(--faint);
  }
  .pv footer .fbrand { font-size: 24px; font-weight: 900; color: var(--cream); }
  .pv footer .social { display: flex; gap: 14px; justify-content: center; margin: 20px 0; }
  .pv footer .social a { color: var(--muted); font-weight: 700; font-size: 14px; border: 1px solid var(--line); padding: 9px 16px; border-radius: 999px; }
  .pv footer .social a:hover { color: var(--gold); border-color: var(--gold); }
  .pv .edit-note {
    margin: 0 auto 0; margin-top: 14px; max-width: 560px; font-size: 12px; color: var(--faint);
  }
`;

export default function Visite() {
  return (
    <div className="pv">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav>
        <a className="brand" href="#topo">
          <span className="mark">🍻</span> {BAR.nome}
        </a>
        <div className="navlinks">
          <a href="#o-pico">O Pico</a>
          <a href="#cardapio">Cardápio</a>
          <a href="#fotos">Fotos</a>
          <a href="#contato">Contato</a>
        </div>
        <a className="navcta" href={linkWhats} target="_blank" rel="noopener">Chamar no WhatsApp</a>
      </nav>

      {/* HERO */}
      <header className="hero" id="topo">
        <div className="wrap">
          <div className="eyebrow">Bar · Chopp · Petiscos · Ao vivo</div>
          <h1>{BAR.nome}<span>é aqui.</span></h1>
          <p className="sub">{BAR.tagline}. {BAR.descricao}</p>
          <div className="cta-row">
            <a className="btn btn-gold" href="#cardapio">Ver o cardápio</a>
            <a className="btn btn-whats" href={linkWhats} target="_blank" rel="noopener">💬 Reservar no WhatsApp</a>
            <a className="btn btn-ghost" href={linkMapa} target="_blank" rel="noopener">📍 Como chegar</a>
          </div>
        </div>
      </header>

      {/* O PICO / HISTÓRIA */}
      <section id="o-pico" style={{ background: 'var(--bg2)' }}>
        <div className="wrap">
          <div className="story">
            <div className="story-side">
              <div className="kicker">O Pico</div>
              <h2>Nossa história</h2>
              <div className="shot story-photo"><div><span>📸</span>Foto do bar / equipe</div></div>
            </div>
            <div className="story-text">
              {BAR.historia.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </div>
        </div>
      </section>

      {/* CARDÁPIO / DESTAQUES */}
      <section id="cardapio">
        <div className="wrap">
          <div className="kicker">O que rola aqui</div>
          <h2>Do chopp ao petisco, tudo no capricho</h2>
          <p className="lead">Uma prévia do que te espera. O cardápio completo está na casa — e sempre tem novidade.</p>

          <div className="grid grid-3">
            {DESTAQUES.map((d) => (
              <div className="card" key={d.nome}>
                <div className="emoji">{d.emoji}</div>
                <h3>{d.nome}</h3>
                <p>{d.desc}</p>
              </div>
            ))}
          </div>

          <div className="promos">
            {PROMOS.map((p) => (
              <div className="promo" key={p.nome}>
                <div className="tag">Promoção</div>
                <h3>{p.nome}</h3>
                <p>{p.quando}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOTOS / GALERIA */}
      <section id="fotos">
        <div className="wrap">
          <div className="kicker">Fotos</div>
          <h2>Um lugar pra ficar até tarde</h2>
          <p className="lead">Fotos do bar, dos drinks e das noites de música ao vivo.</p>
          <div className="gallery">
            {['Fachada / ambiente', 'Chopp & drinks', 'Petiscos', 'Música ao vivo', 'A galera', 'Noite de jogo'].map((label) => (
              <div className="shot" key={label}>
                <div><span>📸</span>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTATO / HORÁRIO / LOCAL */}
      <section id="contato" style={{ background: 'var(--bg2)' }}>
        <div className="wrap">
          <div className="kicker">Contato</div>
          <h2>Horário, local e como falar com a gente</h2>
          <div className="info">
            <div className="panel">
              <h3>🕒 Horário de funcionamento</h3>
              <ul className="hours">
                {BAR.horarios.map((h) => (
                  <li key={h.dia}>
                    <span>{h.dia}</span>
                    <span className={h.fechado ? 'h-fechado' : h.destaque ? 'h-dest' : ''}>{h.hora}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h3>📍 Onde estamos</h3>
              <p className="addr">
                {BAR.endereco}
                <br />
                <span className="muted">Toque em “Como chegar” pra abrir no mapa.</span>
              </p>
              <div className="cta-row" style={{ justifyContent: 'flex-start', marginTop: 22 }}>
                <a className="btn btn-gold" href={linkMapa} target="_blank" rel="noopener">📍 Como chegar</a>
                <a className="btn btn-whats" href={linkWhats} target="_blank" rel="noopener">💬 WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="fbrand">🍻 {BAR.nome}</div>
          <div className="social">
            <a href={linkInsta} target="_blank" rel="noopener">Instagram @{BAR.instagram}</a>
            <a href={linkWhats} target="_blank" rel="noopener">WhatsApp</a>
            <a href={linkMapa} target="_blank" rel="noopener">Mapa</a>
          </div>
          <div>© {new Date().getFullYear()} {BAR.nome}. Todos os direitos reservados.</div>
          <p className="edit-note">
            Página de amostra: os itens marcados (endereço, telefone, @, fotos) são exemplos
            para você trocar pelos dados reais do bar.
          </p>
        </div>
      </footer>
    </div>
  );
}
