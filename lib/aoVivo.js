// O BAR AO VIVO — os números da tela, sem desenho e sem banco.
//
// "Eu quero uma tela em que eu veja quantas pessoas tem no bar e quem está
// trabalhando, nessa pegada" (a do escritório de joguinho, com os bonequinhos
// e o nome em cima de cada um).
//
// De onde sai cada coisa:
//   - pessoas no bar: a soma das pessoas das comandas ABERTAS (é o número que
//     o garçom diz ao abrir a mesa — o app não tem câmera na porta);
//   - mesas: as abertas e as livres, de 1 até o tanto de mesas do bar;
//   - equipe: quem bateu entrada no ponto e ainda não bateu saída. Turno
//     aberto há mais de 16 horas é ponto esquecido, não gente trabalhando.

const ESQUECIDO_MS = 16 * 60 * 60 * 1000;
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const nume = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v == null ? '' : v).trim();
  if (!s) return 0;
  const t = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
};

export const SETOR_NOME = { garcom: 'Atendimento', extra: 'Extra', cozinha: 'Cozinha', gerente: 'Gerente', dona: 'Dona', reservas: 'Reservas' };

function totalDaComanda(c) {
  const sub = (Array.isArray(c.itens) ? c.itens : []).reduce((s, it) => s + nume(it.qtd) * nume(it.preco), 0);
  return r2(sub + (c.servico === false ? 0 : sub * 0.10));
}

export function montarCena({ comandas = [], registros = [], mesasQtd = 0, agora = Date.now() } = {}) {
  const abertas = comandas.filter((c) => c && c.status !== 'fechada' && c.mesa != null && String(c.mesa) !== '');
  const porMesa = new Map();
  for (const c of abertas) porMesa.set(String(c.mesa), c);
  // Mesa aberta com número acima do cadastro (a "mesa 25" num bar de 20)
  // aparece também: gente sentada não some porque o cadastro está curto.
  const numeros = new Set();
  const qtd = Math.max(0, Math.floor(Number(mesasQtd) || 0));
  for (let i = 1; i <= qtd; i += 1) numeros.add(String(i));
  for (const m of porMesa.keys()) numeros.add(m);
  const mesas = [...numeros]
    .sort((a, b) => (Number(a) || 1e9) - (Number(b) || 1e9) || a.localeCompare(b))
    .map((numero) => {
      const c = porMesa.get(numero);
      if (!c) return { numero, ocupada: false };
      const desde = Date.parse(c.abertaEm || '') || null;
      return {
        numero, ocupada: true,
        pessoas: Math.max(0, Math.floor(Number(c.pessoas) || 0)),
        nome: String(c.nome || '').trim(),
        desde: desde ? new Date(desde).toISOString() : null,
        minutos: desde ? Math.max(0, Math.round((agora - desde) / 60000)) : null,
        itens: (Array.isArray(c.itens) ? c.itens : []).reduce((s, it) => s + (nume(it.qtd) || 0), 0),
        total: totalDaComanda(c),
        // Narguilé na comanda: no desenho, ele aparece aceso em cima da mesa.
        narguile: (Array.isArray(c.itens) ? c.itens : []).some((it) => /narg/i.test(String(it && it.nome || '')) && (nume(it.qtd) || 0) > 0),
      };
    });

  // A EQUIPE: uma pessoa por nome (dois turnos abertos do mesmo nome são
  // erro de toque, não duas pessoas).
  const vistos = new Set();
  const equipe = [];
  // Fica a PRIMEIRA entrada (a hora em que a pessoa chegou, e o nome como foi
  // escrito ali); o toque repetido depois não muda nada.
  for (const r of [...registros].sort((a, b) => String(a.entrada || '').localeCompare(String(b.entrada || '')))) {
    if (!r || r.saida || !r.entrada) continue;
    const t = Date.parse(r.entrada);
    if (!t || agora - t > ESQUECIDO_MS || t - agora > 5 * 60000) continue;
    const nome = String(r.nome || '').trim() || SETOR_NOME[r.papel] || 'Equipe';
    const k = nome.toLowerCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    equipe.push({ nome, setor: r.papel || 'garcom', setorNome: SETOR_NOME[r.papel] || 'Equipe', desde: new Date(t).toISOString(), minutos: Math.round((agora - t) / 60000) });
  }
  equipe.sort((a, b) => a.desde.localeCompare(b.desde));

  const ocupadas = mesas.filter((m) => m.ocupada);
  const maisAntiga = ocupadas.filter((m) => m.minutos != null).sort((a, b) => b.minutos - a.minutos)[0] || null;
  return {
    mesas,
    pessoasNoBar: ocupadas.reduce((s, m) => s + m.pessoas, 0),
    mesasOcupadas: ocupadas.length,
    mesasTotal: mesas.length,
    equipe,
    maisAntiga: maisAntiga ? { numero: maisAntiga.numero, minutos: maisAntiga.minutos } : null,
    abertoNoSalao: r2(ocupadas.reduce((s, m) => s + m.total, 0)),
  };
}
