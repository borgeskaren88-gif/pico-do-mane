// O que uma reserva guarda além de nome, dia e hora.
//
// São poucas opções de propósito. Campo livre demais vira um parágrafo que
// ninguém lê no aperto do salão — e o que a cozinha e o atendimento precisam
// saber (é aniversário? vem bolo? alguém não come o quê?) tem que dar pra bater
// o olho e entender. Por isso o que muda o atendimento virou botão, e o texto
// livre ficou só pro resto.

export const OCASIOES = ['Normal', 'Aniversário', 'Comemoração', 'Reunião', 'Encontro'];
export const LOCAIS = ['Tanto faz', 'Mesa dentro', 'Mesa fora'];

export const umDe = (v, lista, padrao) => (lista.includes(String(v || '')) ? String(v) : padrao);

// As etiquetas curtas de uma reserva, na ordem em que interessam a quem está no
// salão. Devolve [] quando não tem nada de especial — reserva comum não precisa
// de enfeite.
export function etiquetasDaReserva(r) {
  const out = [];
  if (!r) return out;
  const oc = umDe(r.ocasiao, OCASIOES, 'Normal');
  if (oc === 'Aniversário') {
    out.push({ texto: r.aniversariante ? `🎂 Aniversário — ${r.aniversariante}` : '🎂 Aniversário', tom: 'festa' });
  } else if (oc !== 'Normal') {
    out.push({ texto: oc, tom: 'festa' });
  }
  if (r.bolo) out.push({ texto: 'traz bolo/doce', tom: 'aviso' });
  const local = umDe(r.local, LOCAIS, 'Tanto faz');
  if (local !== 'Tanto faz') out.push({ texto: local.toLowerCase(), tom: 'neutro' });
  if (r.restricoes) out.push({ texto: r.restricoes, tom: 'aviso' });
  return out;
}

// Uma reserva pede atenção antes da hora? Aniversário com bolo precisa de vela,
// espaço e alguém avisado — não dá pra descobrir isso quando a mesa chega.
export const pedePreparo = (r) => !!r && (umDe(r.ocasiao, OCASIOES, 'Normal') !== 'Normal' || !!r.bolo || !!r.restricoes);

// O resumo de uma linha, pra lista e pra leitura em voz alta do Darci.
export function resumoDaReserva(r) {
  if (!r) return '';
  const q = Number(r.pessoas) || 1;
  const partes = [`${r.nome} · ${q} ${q === 1 ? 'pessoa' : 'pessoas'}`];
  const etq = etiquetasDaReserva(r).map((e) => e.texto);
  if (etq.length) partes.push(etq.join(' · '));
  return partes.join(' · ');
}
