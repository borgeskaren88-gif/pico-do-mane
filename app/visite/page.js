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

// Fotos da galeria (troque/adicione arquivos em public/galeria e edite aqui)
const GALERIA = [
  { src: '/galeria/por-do-sol.jpg', alt: 'Pôr do sol com taça na varanda do Pico do Mané' },
  { src: '/galeria/fim-de-tarde.jpg', alt: 'Fim de tarde no Pico do Mané com vista pra baía' },
  { src: '/galeria/a-galera.jpg', alt: 'Amigas curtindo o dia no Pico do Mané' },
  { src: '/galeria/floripa-noite.jpg', alt: 'Vista de Florianópolis e a ponte Hercílio Luz à noite' },
  { src: '/hero-vista.jpg', alt: 'A vista da baía a partir do Pico' },
  { src: '/galeria/bar-favela.jpg', alt: 'Arte de rua — a alma do Bar Favela' },
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
    --bg: #FFFFFF; --bg2: #F7F4EF; --card: #FFFFFF; --line: #ECE5DA;
    --ink: #221F1A; --muted: #6E6658; --faint: #9A9082;
    --accent: #EC5A3C; --accent2: #F2B21F; --cream: #FFF6E8;
    --shadow: 0 14px 36px rgba(40,28,12,0.10);
    background: var(--bg); color: var(--ink);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.55; -webkit-font-smoothing: antialiased;
  }
  .pv a { color: inherit; text-decoration: none; }
  .pv .wrap { max-width: 1080px; margin: 0 auto; padding: 0 22px; }

  /* NAV */
  .pv nav {
    position: sticky; top: 0; z-index: 20;
    padding: calc(12px + env(safe-area-inset-top)) 22px 12px;
    background: rgba(255,255,255,0.82); backdrop-filter: blur(16px) saturate(1.1); -webkit-backdrop-filter: blur(16px) saturate(1.1);
    border-bottom: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .pv .brand { display: flex; align-items: center; }
  .pv .nav-logo { height: 30px; width: auto; display: block; }
  .pv .navlinks { display: flex; gap: 26px; font-size: 13px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .pv .navlinks a:hover { color: var(--accent); }
  .pv .navcta {
    background: var(--accent); color: #fff; font-weight: 800; font-size: 13px;
    padding: 10px 18px; border-radius: 999px; white-space: nowrap; border: none;
  }
  .pv .navcta:hover { filter: brightness(1.06); }
  @media (max-width: 720px) { .pv .navlinks { display: none; } }

  /* HERO (banner com foto) */
  .pv .hero {
    position: relative; min-height: 78vh; display: flex; align-items: center;
    padding: 80px 0 64px;
    background:
      linear-gradient(180deg, rgba(12,9,6,0.38) 0%, rgba(12,9,6,0.64) 68%, rgba(12,9,6,0.72) 100%),
      url('/hero-vista.jpg') center 32% / cover no-repeat;
    text-align: center;
  }
  .pv .hero .eyebrow {
    color: #FFE39A; font-weight: 800; letter-spacing: .22em; text-transform: uppercase;
    font-size: 13px; margin-bottom: 22px;
  }
  .pv .hero-logo { width: min(560px, 86vw); height: auto; filter: drop-shadow(0 8px 30px rgba(0,0,0,0.6)); }
  .pv .hero p.sub { color: #FFFFFF; font-size: clamp(17px, 2.4vw, 22px); margin: 22px auto 0; max-width: 620px; text-shadow: 0 2px 12px rgba(0,0,0,0.6); }
  .pv .cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 34px; }
  .pv .btn {
    padding: 14px 26px; border-radius: 999px; font-weight: 800; font-size: 15px;
    display: inline-flex; align-items: center; gap: 8px; cursor: pointer; border: 1px solid transparent;
    transition: transform .12s ease, background .15s ease, filter .15s ease;
  }
  .pv .btn:hover { transform: translateY(-2px); }
  /* Botões padrão (nas seções claras): sólidos e limpos */
  .pv .btn-gold { background: var(--accent); color: #fff; }
  .pv .btn-gold:hover { filter: brightness(1.06); }
  .pv .btn-whats { background: #25D366; color: #06331a; }
  .pv .btn-whats:hover { filter: brightness(1.04); }
  .pv .btn-ghost { background: #fff; color: var(--ink); border-color: var(--line); box-shadow: var(--shadow); }
  .pv .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
  /* Botões dentro do hero: efeito lente sobre a foto */
  .pv .hero .btn-gold { background: rgba(255,255,255,0.92); color: #23201C; border-color: rgba(255,255,255,0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 6px 26px rgba(0,0,0,0.2); }
  .pv .hero .btn-gold:hover { background: #fff; }
  .pv .hero .btn-whats { background: rgba(255,255,255,0.12); color: #fff; border-color: rgba(255,255,255,0.4); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
  .pv .hero .btn-whats:hover { background: rgba(255,255,255,0.22); }
  .pv .hero .btn-ghost { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.3); box-shadow: none; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
  .pv .hero .btn-ghost:hover { background: rgba(255,255,255,0.16); color: #fff; border-color: rgba(255,255,255,0.5); }

  /* SECTIONS */
  .pv section { padding: 88px 0; }
  .pv .kicker { color: var(--accent); font-weight: 800; letter-spacing: .18em; text-transform: uppercase; font-size: 13px; }
  .pv h2 { font-size: clamp(30px, 5vw, 44px); font-weight: 900; letter-spacing: -0.01em; margin-top: 10px; color: var(--ink); }
  .pv .lead { color: var(--muted); font-size: 18px; max-width: 640px; margin-top: 14px; }

  /* O PICO / HISTÓRIA */
  .pv .story { display: grid; grid-template-columns: 0.9fr 1.1fr; gap: 44px; align-items: center; }
  .pv .story-photo { aspect-ratio: 4/3; margin-top: 22px; }
  .pv .story-text p { color: var(--muted); font-size: 18px; margin-bottom: 18px; }
  .pv .story-text p:first-child { color: var(--ink); font-size: 22px; font-weight: 700; }
  @media (max-width: 760px) { .pv .story { grid-template-columns: 1fr; gap: 8px; } }

  /* DESTAQUES GRID */
  .pv .grid { display: grid; gap: 18px; margin-top: 40px; }
  .pv .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .pv .card {
    background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 26px; box-shadow: var(--shadow);
  }
  .pv .card .emoji { font-size: 34px; }
  .pv .card h3 { font-size: 19px; font-weight: 800; margin: 12px 0 6px; color: var(--ink); }
  .pv .card p { color: var(--muted); font-size: 15px; }
  @media (max-width: 860px) { .pv .grid-3 { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px) { .pv .grid-3 { grid-template-columns: 1fr; } }

  /* PROMOS */
  .pv .promos { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 32px; }
  .pv .promo {
    flex: 1 1 200px; background: #FFF4EF;
    border: 1px solid #F6D3C7; border-radius: 18px; padding: 22px;
  }
  .pv .promo .tag { color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .pv .promo h3 { font-size: 22px; font-weight: 900; margin: 8px 0 4px; color: var(--ink); }
  .pv .promo p { color: var(--muted); font-size: 14px; }

  /* GALERIA */
  .pv .gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 40px; }
  .pv .shot {
    position: relative; aspect-ratio: 1/1; border-radius: 20px; overflow: hidden;
    background: #F1ECE3; box-shadow: var(--shadow);
  }
  .pv .shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
  @media (max-width: 560px) { .pv .gallery { grid-template-columns: 1fr 1fr; } }

  /* VISITE (info) */
  .pv .info { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 40px; }
  .pv .panel { background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 28px; box-shadow: var(--shadow); }
  .pv .panel h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .1em; color: var(--accent); font-weight: 800; margin-bottom: 16px; }
  .pv .hours { list-style: none; }
  .pv .hours li { display: flex; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); font-size: 15px; color: var(--ink); }
  .pv .hours li:last-child { border-bottom: none; }
  .pv .hours .h-fechado { color: var(--faint); }
  .pv .hours .h-dest { color: var(--accent); font-weight: 700; }
  .pv .addr { font-size: 17px; line-height: 1.6; color: var(--ink); }
  .pv .addr .muted { color: var(--muted); font-size: 14px; }
  @media (max-width: 720px) { .pv .info { grid-template-columns: 1fr; } }

  /* FOOTER */
  .pv footer {
    border-top: 1px solid var(--line); background: var(--bg2);
    padding: 54px 0 calc(46px + env(safe-area-inset-bottom));
    text-align: center; color: var(--muted);
  }
  .pv footer .foot-logo { height: 56px; width: auto; }
  .pv footer .social { display: flex; gap: 12px; justify-content: center; margin: 22px 0; flex-wrap: wrap; }
  .pv footer .social a {
    color: var(--ink); font-weight: 700; font-size: 14px;
    background: #fff; border: 1px solid var(--line);
    padding: 10px 18px; border-radius: 999px; box-shadow: var(--shadow);
  }
  .pv footer .social a:hover { color: var(--accent); border-color: var(--accent); }
  .pv .edit-note {
    margin: 14px auto 0; max-width: 560px; font-size: 12px; color: var(--faint);
  }
`;

export default function Visite() {
  return (
    <div className="pv">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* NAV */}
      <nav>
        <a className="brand" href="#topo">
          <img className="nav-logo" src="/logo-pico.png" alt="Pico do Mané — Bar Favela" />
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
          <div className="eyebrow">Florianópolis · Vista pra baía</div>
          <img className="hero-logo" src="/logo-pico.png" alt="Pico do Mané — Bar Favela" />
          <p className="sub">{BAR.tagline}.</p>
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
              <div className="shot story-photo"><img src="/galeria/bar-favela.jpg" alt="Arte de rua — a alma do Bar Favela" loading="lazy" /></div>
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
            {GALERIA.map((g) => (
              <div className="shot" key={g.src}>
                <img src={g.src} alt={g.alt} loading="lazy" />
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
          <img className="foot-logo" src="/logo-pico.png" alt="Pico do Mané — Bar Favela" />
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
