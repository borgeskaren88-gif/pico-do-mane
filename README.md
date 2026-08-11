# Nossas Finanças — controle de gastos do casal

Um app simples para você e sua parceira/parceiro anotarem os gastos e as
entradas do mês. **Cada um tem a sua própria senha**, os dois enxergam **todos
os gastos juntos**, e o app mostra quem lançou cada coisa, quanto cada um
gastou e para onde o dinheiro está indo.

Funciona no navegador de qualquer aparelho (celular, computador) e dá para
"instalar" na tela inicial do celular como se fosse um aplicativo.

Colocar no ar leva uns 15-20 minutos, tudo pelo navegador, sem instalar nada.
São 3 etapas: **Supabase** (onde os dados ficam guardados), **GitHub** (onde o
código fica) e **Vercel** (onde o site fica no ar). Siga na ordem.

---

## 1. Criar o banco de dados (Supabase)

1. Acesse **supabase.com** → **Start your project** → crie uma conta (pode ser
   com o Google, é mais rápido)
2. Clique em **New project**
   - Nome: `nossas-financas` (o que quiser)
   - Senha do banco: gere uma e guarde num lugar seguro
   - Região: a mais próxima do Brasil (South America - São Paulo, se houver)
3. Espere o projeto ser criado (1-2 minutos)
4. No menu lateral, clique em **SQL Editor** → **New query**
5. Abra o arquivo `supabase.sql` (está junto com este projeto), copie todo o
   conteúdo, cole no editor, e clique em **Run**
   - Isso cria a tabela onde os lançamentos vão morar
6. Agora vá em **Project Settings** (ícone de engrenagem) → **API**
7. Guarde num bloco de notas estes dois valores:
   - **Project URL** (algo como `https://seu-projeto.supabase.co`)
   - **service_role key** (uma chave longa, em "Project API keys" — ⚠️ essa
     chave é secreta, não compartilhe nem coloque em lugar público)

---

## 2. Subir o código (GitHub)

1. Acesse **github.com** → crie uma conta gratuita, se ainda não tiver
2. Clique no **+** no canto superior direito → **New repository**
   - Nome: `nossas-financas`
   - Marque como **Private** (privado)
   - Clique em **Create repository**
3. Na página do repositório vazio, clique em **uploading an existing file**
   (ou "Add file" → "Upload files")
4. Arraste **todos os arquivos e pastas** deste projeto para a área de upload
5. Role para baixo, escreva "primeira versão" e clique em **Commit changes**

---

## 3. Colocar no ar (Vercel)

1. Acesse **vercel.com** → **Sign Up** → **Continue with GitHub**
2. Clique em **Add New** → **Project**
3. Encontre o repositório `nossas-financas` e clique em **Import**
4. Antes de clicar em Deploy, abra **Environment Variables** e adicione,
   uma de cada vez (nome à esquerda, valor à direita):

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | a Project URL que você guardou no passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | a service_role key que você guardou no passo 1 |
   | `USUARIO1_NOME` | seu nome (ex.: `Karen`) |
   | `USUARIO1_SENHA` | a senha que **você** vai usar para entrar |
   | `USUARIO2_NOME` | o nome dela (ex.: `Mariele`) |
   | `USUARIO2_SENHA` | a senha que **ela/ele** vai usar para entrar |
   | `SESSION_SECRET` | uma frase longa e aleatória, só sua (ex.: `cavalo-azul-2026-xyz`) |

5. Clique em **Deploy**
6. Espere 1-2 minutos. Quando terminar, a Vercel te dá um link tipo
   `https://nossas-financas.vercel.app` — **esse é o seu link definitivo**

---

## Como usar no dia a dia

1. Cada um abre o link e entra com **a sua própria senha**
2. Digite o **valor**, escolha se é **Gasto** ou **Entrada**, a **categoria**,
   a data e (se quiser) uma descrição → **Adicionar**
3. Os dois veem a lista completa do mês, com o nome de quem lançou cada item
4. No topo aparecem os totais do mês: **Gastos**, **Entradas** e **Saldo**
5. Mais abaixo, o resumo de **quanto cada um gastou** e os **gastos por
   categoria**
6. Use as setas ‹ › para ver outros meses

**Dica:** no celular, abra o link e use "Adicionar à Tela de Início" (iPhone)
ou "Instalar app" (Android) para ele virar um ícone como um aplicativo.

---

## Como atualizar depois

Quando quiser mudar algo, é só editar os arquivos no GitHub (ícone de lápis →
colar o conteúdo novo → **Commit changes**). A Vercel detecta a mudança
sozinha e atualiza o site em ~1 minuto, sem publicar nada manualmente.

Para trocar uma senha ou um nome, não precisa mexer no código: vá em
**Vercel → seu projeto → Settings → Environment Variables**, edite o valor e
faça um novo deploy (Deployments → botão "Redeploy").

---

## Segurança

- As senhas e a `SESSION_SECRET` ficam guardadas só no servidor da Vercel,
  nunca aparecem no código que roda no navegador.
- Os dados ficam no Supabase, protegidos por uma chave que só o backend conhece
  (a `service_role key`), com acesso direto pelo navegador bloqueado.
- Cada pessoa entra com a própria senha; quem lança um gasto é identificado
  automaticamente pelo login, sem dar para "se passar" pela outra pessoa.
