# O laboratório

Um bar de mentira pra testar o app sem tocar no bar de verdade.

## Por que isto mora no repositório

Morava numa pasta temporária. O container reiniciou e **65 suítes de teste
sumiram de uma vez** — todas as provas construídas ao longo de uma semana. O
código do app estava salvo; as provas não.

Teste que mora em lugar que some não é rede de segurança: é sorte. Agora mora
aqui, versionado junto com o que ele protege.

## Antes de rodar, uma vez por container

Os testes que abrem o navegador precisam do Playwright. Ele NÃO entra no
`package.json` de propósito: lá ele pesaria todo build da Vercel e baixaria
navegador no deploy, sem servir pra nada em produção.

```sh
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright --no-save
```

O navegador já está na máquina, em `/opt/pw-browsers/chromium` — é por isso que
os testes passam `executablePath` em vez de baixar o deles.

## Como roda

```sh
node lab/pgrest.mjs &                      # o banco de mentira, na porta 54321
sh lab/rodar.sh lab/<teste>.mjs            # semeia e roda
```

O app de teste sobe assim:

```sh
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=chave-de-mentira \
APP_PASSWORD=Teste@123 SESSION_SECRET=um-texto-longo-e-aleatorio-so-pra-teste \
NEGOCIO_UNICO=pico-do-mane npx next start -p 3100
```

## As regras que os testes seguem

- **Cada teste diz o problema humano que ele guarda**, no cabeçalho, com as
  palavras de quem reclamou. Teste sem essa frase vira teste que ninguém ousa
  apagar nem sabe por que existe.
- **A prova tem que ser legível quando falhar.** Já aconteceu de um teste
  comparar `undefined` com `undefined` e passar sem provar nada, e de outro
  imprimir a linha de outro produto. Prova que não dá pra ler é prova em que
  não dá pra confiar.
- **Teste que passa às vezes não protege.** Quando um falhar de forma
  intermitente, a causa se acha antes de seguir — não se roda de novo até dar
  verde.
