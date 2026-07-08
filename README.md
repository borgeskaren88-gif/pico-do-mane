# Central Pico do Mané — site próprio

Este é o mesmo painel que você já usa, agora como um site de verdade: link fixo,
sem cache travando, funciona igual em qualquer aparelho. Leva uns 15-20 minutos
para colocar no ar, tudo por navegador, sem instalar nada no computador.

São 3 etapas: **Supabase** (onde os dados ficam guardados), **GitHub** (onde o
código fica guardado) e **Vercel** (onde o site fica no ar). Siga na ordem.

---

## 1. Criar o banco de dados (Supabase)

1. Acesse **supabase.com** → **Start your project** → crie uma conta (pode ser
   com o Google, é mais rápido)
2. Clique em **New project**
   - Nome: `pico-do-mane` (o que quiser)
   - Senha do banco: gere uma e guarde num lugar seguro (não vamos precisar
     dela nos próximos passos, mas guarde por segurança)
   - Região: escolha a mais próxima do Brasil (South America - São Paulo, se
     disponível)
3. Espere o projeto ser criado (1-2 minutos)
4. No menu lateral, clique em **SQL Editor** → **New query**
5. Abra o arquivo `supabase.sql` (está junto com este projeto), copie todo o
   conteúdo, cole no editor, e clique em **Run**
   - Isso cria a "tabela" onde os dados do painel vão morar
6. Agora vá em **Project Settings** (ícone de engrenagem) → **API**
7. Guarde em algum lugar (um bloco de notas, por exemplo) estes dois valores:
   - **Project URL** (algo como `(https://qdjpeggwnskuenwkghxg.supabase.co)`)
   - **service_role key** (uma chave longa, em "Project API keys" — ⚠️ essa
     chave é secreta, não compartilhe nem coloque em lugar público)

---

## 2. Subir o código (GitHub)

1. Acesse **github.com** → crie uma conta gratuita, se ainda não tiver
2. Clique no **+** no canto superior direito → **New repository**
   - Nome: `pico-do-mane`
   - Marque como **Private** (privado)
   - Clique em **Create repository**
3. Na página do repositório vazio, clique no link **uploading an existing
   file** (ou "Add file" → "Upload files")
4. Arraste **todos os arquivos e pastas** deste projeto para a área de upload
   (pode arrastar a pasta inteira)
5. Role para baixo, escreva algo como "primeira versão" e clique em
   **Commit changes**

---

## 3. Colocar no ar (Vercel)

1. Acesse **vercel.com** → **Sign Up** → escolha **Continue with GitHub**
   (assim ele já conecta direto com sua conta do GitHub)
2. Clique em **Add New** → **Project**
3. Encontre o repositório `pico-do-mane` na lista e clique em **Import**
4. Antes de clicar em Deploy, abra **Environment Variables** e adicione,
   uma de cada vez (nome à esquerda, valor à direita):

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | a Project URL que você guardou no passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | a service_role key que você guardou no passo 1 |
   | `APP_PASSWORD` | a senha que você quiser usar para entrar no painel |
   | `SESSION_SECRET` | qualquer frase longa e aleatória, só sua (ex: "cavalo-azul-mocoto-2026-xyz") |

5. Clique em **Deploy**
6. Espere 1-2 minutos. Quando terminar, a Vercel te dá um link tipo
   `https://pico-do-mane.vercel.app` — **esse é o seu link definitivo**

Pronto. Esse link não muda mais, funciona em qualquer aparelho, e sempre que
eu (Claude) editar algo, o processo de atualizar é bem mais simples que no
Claude — explico lá embaixo em "Como atualizar depois".

---

## Primeiro acesso

1. Abra o link da Vercel
2. Digite a senha que você colocou em `APP_PASSWORD`
3. O painel deve abrir já com todos os dados das suas planilhas (o mesmo que
   já estava no Claude)

Se abrir vazio por algum motivo, vá em **Backup** → **"↺ Recarregar dados
originais das planilhas"**, igual fazíamos antes — só que agora, como salva
tudo direto no Supabase, não deve mais ter o problema de sumir dado.

---

## Como atualizar depois

Quando você quiser mudar algo, me peça aqui no chat como sempre. Eu vou
editar os arquivos e te dar os arquivos atualizados. Você:

1. Vai no seu repositório no GitHub
2. Abre o arquivo que mudou, clica no ícone de lápis (editar), cola o
   conteúdo novo, clica em **Commit changes**
   - (Ou: apaga os arquivos antigos e sobe os novos, se for mais fácil)
3. A Vercel detecta a mudança sozinha e atualiza o site em ~1 minuto —
   **sem precisar publicar nada manualmente**

Se preferir algo ainda mais direto para esse fluxo de "eu mudo o código com
frequência", existe o **Claude Code**, uma ferramenta da Anthropic que
trabalha direto na pasta do projeto — nesse caso eu consigo editar e você só
confirma. Vale considerar se isso virar rotina.

---

## Dúvidas de segurança

- A senha (`APP_PASSWORD`) fica guardada só no servidor da Vercel, nunca
  aparece no código que roda no navegador — diferente da versão anterior no
  Claude, aqui ninguém consegue "ver" a senha inspecionando a página.
- Os dados ficam no Supabase, também no servidor, protegidos por uma chave
  que só o backend conhece (a `service_role key`).
- Se um dia quiser dar acesso ao Tiago com login próprio dele (não a mesma
  senha), me avisa — dá para evoluir isso com contas separadas via Supabase
  Auth.
