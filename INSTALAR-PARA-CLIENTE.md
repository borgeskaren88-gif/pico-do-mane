# Instalar o PicoOS para um cliente

Este guia é para **instalar uma cópia do PicoOS para outra pessoa** — não para
mexer no seu. Leva uns 30 minutos na primeira vez e uns 15 nas seguintes.

Cada cliente recebe **um site próprio e um banco de dados próprio**. Eles nunca
se enxergam: cada um tem o seu endereço, as suas senhas e os seus números.

> **A regra que não pode ser quebrada:** nunca reaproveitar o banco de dados nem
> as chaves de um cliente em outro. Se dois sites apontarem para o mesmo banco,
> um vai ver o movimento do outro — e isso acaba com o negócio no mesmo dia.

---

## Antes de começar

Tenha à mão:

- O e-mail do cliente (para ele receber o link)
- Um gerenciador de senhas ou um caderno — você vai criar 5 senhas novas
- Acesso às suas contas da **Vercel** e do **Supabase**

---

## Passo 1 — Banco de dados novo (Supabase)

1. Entre em **supabase.com** → **New project**
   - Nome: o nome do cliente (ex.: `boteco-da-ana`) — assim você não confunde
     depois, quando tiver vários
   - Senha do banco: gere uma nova e guarde
   - Região: **South America (São Paulo)**
2. Espere o projeto ficar pronto (1-2 minutos)
3. **SQL Editor** → **New query** → cole o conteúdo do arquivo `supabase.sql`
   (está neste mesmo projeto) → **Run**
4. **Project Settings** → **API** → anote dois valores:
   - **Project URL**
   - **service_role key** (chave secreta — nunca mande por conversa, nunca
     ponha em lugar público)

⚠️ **Projeto novo, sempre.** Não reaproveite o seu nem o de outro cliente.

---

## Passo 2 — Site novo (Vercel)

1. Entre em **vercel.com** → **Add New** → **Project**
2. Importe o **mesmo repositório** do PicoOS (é o mesmo código para todo mundo —
   o que muda é a configuração)
3. Dê um nome que identifique o cliente (ex.: `picoos-boteco-da-ana`)
4. **Não clique em Deploy ainda.** Antes, abra **Environment Variables** e
   preencha o passo 3.

---

## Passo 3 — As configurações (Environment Variables)

### Obrigatórias

| Nome | O que pôr |
|---|---|
| `SUPABASE_URL` | O **Project URL** do passo 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | A **service_role key** do passo 1 |
| `SESSION_SECRET` | Um texto longo e aleatório, só desse cliente |
| `APP_PASSWORD` | A senha de quem manda no negócio |

**O `SESSION_SECRET`** é o que assina quem está logado. Escreva uns 40
caracteres embaralhados, sem sentido nenhum, direto no campo da Vercel.
**Um diferente por cliente** — se dois sites usarem o mesmo, um crachá de um
poderia valer no outro.

### Pode deixar em branco — a equipe entra com `1234` e troca depois

| Nome | O que pôr |
|---|---|
| `APP_PASSWORD_COZINHA` | Senha da cozinha / produção |
| `APP_PASSWORD_GARCOM` | Senha do atendimento |
| `APP_PASSWORD_RESERVAS` | Senha de quem cuida das reservas |

**Deixar as três em branco é a escolha mais prática:** a equipe entra com `1234`
no primeiro dia, sem você precisar combinar senha com ninguém, e o próprio
cliente troca depois em **Configurações → Acessos**.

O risco de o `1234` ficar esquecido está coberto: enquanto algum acesso ainda
estiver na senha de fábrica, **o app mostra um aviso em todas as telas do dono**,
com um botão que leva direto à troca. O aviso some sozinho no instante em que a
senha é trocada, e volta a cada acesso se ele adiar.

A senha de **quem manda** (`APP_PASSWORD`) não tem padrão de fábrica nenhum —
essa você precisa definir.

### Opcionais

| Nome | Para quê |
|---|---|
| `APP_URL` | O endereço final do site. Só é preciso se o cliente for conectar o Google Agenda |
| `CRON_SECRET` | Protege o aviso diário no celular. Um texto aleatório qualquer |

---

## ⚠️ O que NÃO pode ir junto

Se você duplicar o seu projeto na Vercel em vez de criar um novo, **as suas
chaves vão junto sem avisar**. Confira que **nenhuma** destas está no projeto do
cliente:

- `ANTHROPIC_API_KEY` e `OPENAI_API_KEY` — são as do Darci. Cada pergunta dele
  sai **do seu bolso**.
- `ELEVENLABS_API_KEY`, `AZURE_SPEECH_KEY` — a voz do Darci, mesma história.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — ligadas à **sua** conta Google.
- O seu `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — este é o pior de todos:
  o cliente abriria o app e veria **a sua empresa**.

O PicoOS tem uma rede embaixo disso: um app novo nasce com o Darci **desligado**,
mesmo que a chave esteja no servidor. Mas a rede é a segunda linha de defesa — a
primeira é não pôr a chave lá.

---

## Passo 4 — Publicar e abrir

1. **Deploy**. Espere terminar (1-2 minutos).
2. Abra o endereço que a Vercel deu.
3. Entre com o papel **Dona** e a senha que você pôs em `APP_PASSWORD`.
4. O app vai abrir **vazio**, com a tela de boas-vindas. Preencha o nome do
   negócio e o nome da pessoa.
5. Em **Configurações → Meu negócio**, ajuste o nome de cada acesso (num salão,
   "Cozinha" pode virar "Recepção").

---

## Conferir antes de entregar

Passe esta lista **dentro do app do cliente**, não no seu:

- [ ] A tela de entrada mostra o nome do negócio **dele**
- [ ] O Dashboard não tem nenhum lançamento — tudo zerado
- [ ] Em Abastecimento → Estoque não existe nenhum produto
- [ ] **Darci não aparece no menu**
- [ ] O rodapé mostra uma versão (significa que publicou certo)
- [ ] Entrar com cozinha, atendimento e reservas funciona com `1234`
- [ ] O aviso de senha de fábrica aparece — é ele que vai cobrar a troca
- [ ] Abrir o seu app em outra aba e conferir que os números continuam os seus

A última é a mais importante. Faça sempre.

---

## Quando o PicoOS mudar

Cada cópia é um projeto separado, então **cada uma precisa ser publicada**. Na
Vercel, no projeto do cliente: **Deployments** → **Redeploy** na versão mais
nova.

É o custo do caminho "uma cópia por cliente". Com 2 ou 3 é tranquilo. Quando
passar disso, vale a conversa sobre juntar todo mundo num app só.

---

## No fim do teste

**Se o cliente continuar:** não precisa fazer nada, segue como está.

**Se não continuar:**

1. Pergunte se ele quer os dados. Se quiser: abra o app dele, vá em
   **Configurações → Backup e relatório** e baixe o arquivo. Mande para ele.
2. Apague o projeto na **Vercel**.
3. Apague o projeto no **Supabase**.

Apagar os dois é o certo. Guardar o movimento financeiro de alguém que não é
mais cliente não traz nenhum benefício e é responsabilidade sua enquanto existir.
