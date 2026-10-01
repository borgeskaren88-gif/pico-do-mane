// A MUDANÇA DE CASA: PÔR O DONO NO NOME DE CADA LINHA.
//
// Até aqui, "de quem é este dado?" era respondido de fora: do dono deste site.
// Agora o dono vai no nome da linha ("painel" vira "n:pico-do-mane:painel"), e
// é isso que permite muitos negócios no mesmo banco.
//
// Este script faz essa renomeação num projeto do Supabase. Ele foi escrito pra
// ser chato de usar errado:
//
//   - por padrão NÃO MUDA NADA: só mostra o que faria;
//   - só renomeia linha que ainda não tem dono — rodar duas vezes não estraga;
//   - nunca apaga: escreve a linha nova e só então remove a velha;
//   - se a linha nova já existir com conteúdo, ele PARA e avisa.
//
// Como usar:
//
//   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
//   node scripts/mudar-de-casa.mjs --negocio=pico-do-mane
//
//   (olha a lista; se estiver certa, repete com --valendo)
//
// E pra voltar atrás, se precisar:
//
//   node scripts/mudar-de-casa.mjs --negocio=pico-do-mane --desfazer --valendo

const arg = (nome) => {
  const p = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return p ? p.slice(nome.length + 3) : (process.argv.includes(`--${nome}`) ? true : null);
};

const URL_BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NEGOCIO = String(arg('negocio') || '').trim().toLowerCase();
const VALENDO = arg('valendo') === true;
const DESFAZER = arg('desfazer') === true;

if (!URL_BASE || !CHAVE) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(NEGOCIO)) {
  console.error('Falta --negocio=<codigo> (minúsculas, números e hífen).');
  process.exit(1);
}

const MARCA = `n:${NEGOCIO}:`;
const api = (caminho, init) => fetch(`${URL_BASE}/rest/v1/pdm_dados${caminho}`, {
  ...init,
  headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
});

const todas = await (await api('?select=chave,valor,atualizado_em')).json();
if (!Array.isArray(todas)) {
  console.error('Não consegui ler a tabela:', JSON.stringify(todas).slice(0, 200));
  process.exit(1);
}

// A lista da administração ("adm:") não é de negócio nenhum e fica onde está.
const daCasa = todas.filter((l) => !String(l.chave).startsWith('adm:'));
const semDono = daCasa.filter((l) => !String(l.chave).startsWith('n:'));
const comDono = daCasa.filter((l) => String(l.chave).startsWith(MARCA));

const mover = DESFAZER ? comDono : semDono;
const novoNome = (chave) => (DESFAZER ? String(chave).slice(MARCA.length) : MARCA + chave);

console.log(`\nProjeto: ${URL_BASE}`);
console.log(`Negócio: ${NEGOCIO}`);
console.log(`Linhas no total: ${todas.length}  ·  sem dono: ${semDono.length}  ·  já de ${NEGOCIO}: ${comDono.length}`);
console.log(DESFAZER ? '\nVAI TIRAR o dono do nome de:' : '\nVAI PÔR o dono no nome de:');
for (const l of mover.slice(0, 12)) console.log(`   ${l.chave}  ->  ${novoNome(l.chave)}`);
if (mover.length > 12) console.log(`   ... e mais ${mover.length - 12}`);
if (!mover.length) { console.log('\nNada a fazer. (Já está como deveria.)'); process.exit(0); }

// Se o destino já existir com conteúdo, parar. Significa que alguém já mexeu
// aqui, e sobrescrever seria apagar o trabalho de outra pessoa.
const existentes = new Set(todas.map((l) => String(l.chave)));
const colisoes = mover.map((l) => novoNome(l.chave)).filter((k) => existentes.has(k));
if (colisoes.length) {
  console.error(`\nPAREI. Estas linhas já existem no destino: ${colisoes.slice(0, 5).join(', ')}`);
  console.error('Conferir à mão antes de continuar — sobrescrever apagaria o que está lá.');
  process.exit(1);
}

if (!VALENDO) {
  console.log('\n--- ENSAIO: nada foi mudado. Repete com --valendo pra valer. ---');
  process.exit(0);
}

console.log('\nMudando...');
let feitas = 0;
for (const l of mover) {
  const nova = novoNome(l.chave);
  // Escreve a nova PRIMEIRO. Se cair a luz no meio, sobra linha duplicada —
  // que é chato e se resolve. Apagar primeiro perderia o dado.
  const r1 = await api('?on_conflict=chave', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ chave: nova, valor: l.valor, atualizado_em: l.atualizado_em || new Date().toISOString() }]),
  });
  if (!r1.ok) { console.error(`  FALHOU ao escrever ${nova}: ${r1.status} ${await r1.text()}`); process.exit(1); }

  // Confere que chegou inteiro antes de apagar a velha.
  const conf = await (await api(`?select=valor&chave=eq.${encodeURIComponent(nova)}`)).json();
  if (JSON.stringify(conf?.[0]?.valor) !== JSON.stringify(l.valor)) {
    console.error(`  FALHOU a conferência de ${nova} — a velha NÃO foi apagada. Parando aqui.`);
    process.exit(1);
  }

  const r2 = await api(`?chave=eq.${encodeURIComponent(l.chave)}`, { method: 'DELETE' });
  if (!r2.ok) { console.error(`  FALHOU ao apagar ${l.chave}: ${r2.status}`); process.exit(1); }
  feitas++;
  if (feitas % 25 === 0) console.log(`   ${feitas}/${mover.length}`);
}

console.log(`\nPronto: ${feitas} linha(s).`);
console.log(DESFAZER
  ? 'Agora tira o NEGOCIO_UNICO da Vercel e publica de novo.'
  : `Agora põe NEGOCIO_UNICO=${NEGOCIO} na Vercel e publica de novo.`);
