# Mapa: o PicoOS de muitos negócios num app só

Hoje cada cliente tem **uma cópia inteira** — site próprio e banco próprio. Isso
acabou: o Supabase deixa ter **2 projetos no plano grátis**, e os dois já são o
Pico do Mané e o Estimado. O terceiro cliente não entra.

Este documento é o que vai ser feito, o que vai doer, e o que a Karen precisa
fazer. **Nada começa antes de ela ler e aprovar.**

---

## O que existe hoje

| | |
|---|---|
| Rotas de API | 39, sendo **27 que falam com o banco** |
| Lugares no código que leem/escrevem na tabela | **135** |
| Tabela | `pdm_dados (chave, valor, atualizado_em)` |
| Quem é o dono dos dados | **o projeto inteiro** — não existe "de quem é esta linha" |
| Quem é a dona | a variável `APP_PASSWORD` do site |
| O que assina quem está logado | a variável `SESSION_SECRET` do site |

Repara na terceira linha. Hoje a resposta para "de quem é este dado?" é
*"de quem for o dono deste site"*. Não tem nada no dado dizendo isso. É por
isso que separar clientes exige um site inteiro por cliente.

---

## A ideia

Cada linha passa a ter dono no nome dela:

```
hoje                       depois
painel              →      n:boteco:painel
venda:k7x2          →      n:boteco:venda:k7x2
comanda:3           →      n:boteco:comanda:3
                           n:estimado:painel
                           n:estimado:venda:a91f
```

O banco é um só. Os dados de cada negócio não se encostam porque **o nome da
linha carrega o dono**.

---

## O perigo, dito com todas as letras

São **135 lugares** que falam com o banco. Se eu sair carimbando o dono em 135
lugares na mão, mais cedo ou mais tarde eu esqueço um. E o lugar esquecido não
dá erro, não aparece vermelho na tela: ele devolve **a linha de outro cliente**.

Um cliente abre o app e vê o faturamento de outro. Isso acaba com o nome da
Karen num dia, e não tem como desfazer.

**Então não vai ser feito assim.**

### Como vai ser feito: errar tem que quebrar, não vazar

Entra uma peça no meio do caminho — todo pedido ao banco passa por ela, e é ela
que carimba o dono. Quem chama não tem como esquecer, porque **quem não disser
de que negócio está falando leva um erro na cara e a tela não abre**.

```
rota da API  →  [ a peça do meio ]  →  banco
                carimba o dono
                sem dono = erro, não leitura
```

Uma tela quebrada a Karen descobre em cinco minutos e eu conserto. Um vazamento
silencioso ela descobre pelo cliente, tarde demais. **A peça do meio troca o
segundo caso pelo primeiro.** É a decisão mais importante deste projeto inteiro.

### E os testes vão tentar vazar de propósito

No laboratório vão existir dois negócios de mentira com movimento diferente. Os
testes **tentam** ler os dados de um estando logado no outro — pela tela, pela
API, pelo link do calendário, pelo link do widget. Se qualquer tentativa
conseguir, o teste falha e nada é publicado.

Isso não é opcional e não é "se der tempo". É parte do serviço.

---

## O que mais muda

### 1. Entrar no app

Hoje a pessoa abre o endereço dela e digita a senha. Agora o endereço é o mesmo
para todo mundo, então a tela de entrada ganha um campo:

```
Código do negócio:  [ boteco        ]
Senha:              [ ••••••••      ]
```

O código fica guardado no aparelho — a pessoa digita uma vez e não vê mais.

Mais pra frente, quando a Karen tiver um domínio próprio, dá pra virar
`boteco.picoos.com.br` e o campo some. Mas isso depende de comprar domínio, e
não precisa ser agora.

### 2. As senhas saem do site e vão pro banco

Hoje a senha da dona é uma configuração do site (`APP_PASSWORD`). Com um site só
para todos, isso não existe mais: **a senha de cada negócio passa a morar no
banco**, junto com os dados dele.

O jeito de guardar senha com segurança já existe no PicoOS (é o que a tela de
Acessos usa). O que muda é que ele passa a valer para todos os acessos,
inclusive o da dona.

### 3. O crachá de quem está logado

O que prova que alguém está logado é um número calculado a partir do
`SESSION_SECRET`. Com um site só, esse número passa a levar o negócio dentro —
senão o crachá de um cliente valeria no outro. Mesma coisa para os links do
calendário e do widget, que entram sem senha.

### 4. Uma tela só da Karen

Uma área que só ela entra, para:

- criar um negócio novo (é isso que vira "vender um sistema": **um minuto**, não
  30);
- suspender quem parou de pagar;
- ver quem está usando e quanto cada um ocupa.

### 5. O backup

Hoje o backup é "tudo o que tem no banco", porque o banco é de um cliente só.
Passa a ser "tudo o que tem no banco **deste negócio**". Vale também para o
backup automático diário.

---

## O caminho, em etapas

Cada etapa fecha com teste verde antes da seguinte começar.

| | O quê | Termina quando | |
|---|---|---|---|
| **1** | A peça do meio + os testes que tentam vazar | dois negócios de mentira convivem no laboratório sem se enxergar | ✅ |
| **2** | Entrar com código do negócio; senhas e crachás por negócio | dá pra entrar nos dois, e o crachá de um não vale no outro | ✅ |
| **3** | A tela da Karen: criar, suspender, listar | ela cria um negócio do zero sem mexer em Supabase nem Vercel | ✅ |
| **4** | Backup e relatório por negócio | o backup de um não traz nada do outro | ✅ (veio junto) |
| **5** | Ligar as 27 rotas + a mudança de casa | Estimado e Pico do Mané rodando com o dono no nome das linhas | pronto, esperando a hora |

**A etapa 4 não existiu como trabalho separado.** O backup já filtrava por chave,
então ele virou "por negócio" sozinho no instante em que as rotas passaram pela
peça do meio. Está provado junto com o resto.

Não dá pra fazer tudo isso numa sentada, e eu não vou fingir que dá. São
**várias conversas nossas**, com coisa publicada e testada no fim de cada uma.
A Karen acompanha etapa por etapa, e pode parar em qualquer ponto — até a etapa
5, nada do que está no ar hoje é tocado.

---

## A mudança de casa

**Não precisa de projeto novo no Supabase** — o que é ótimo, porque não dá pra
criar. O projeto do **Estimado** vira o projeto compartilhado:

1. O Estimado já está lá dentro e quase vazio. Ele vira o primeiro negócio do
   app único, no lugar onde já está.
2. O Pico do Mané muda de casa depois, com o movimento todo, pelo backup.
3. O projeto antigo do Pico do Mané fica **intacto por umas semanas**, como rede.
   Só é apagado quando a Karen estiver segura.

Ordem proposta: **o Estimado primeiro**. Ele tem pouca coisa a perder, a Karen
fala com eles todo dia, e se algo der errado o estrago é pequeno. O Pico do Mané
— que tem o movimento de verdade — só depois de uma semana do outro rodando liso.

### O que vai incomodar, e não tem como evitar

**O endereço muda.** Quem já pôs o PicoOS na tela do celular ou do iPad vai ter
que apagar e pôr de novo, com o endereço novo. É uma vez só, leva um minuto, mas
precisa ser avisado antes — não no dia.

**Tem um intervalo de silêncio na mudança.** Enquanto os dados estão sendo
copiados, ninguém pode lançar nada, senão o que for lançado fica pra trás. Vai
ser de madrugada, com o bar fechado, e dura alguns minutos.

---

## A hora da virada — o único passo que mexe no que está no ar

O código da etapa 5 está pronto e testado, **mas não foi juntado no `main`**, e
isso é de propósito: a Vercel publica sozinha a cada junção, e este é o único
pedaço que **não pode** subir sozinho. Ele precisa de duas coisas ao mesmo
tempo: o código novo e as linhas renomeadas. Subir um sem o outro deixa o app
aberto e vazio por alguns minutos.

Então a virada é uma operação combinada, de manhã cedo ou de madrugada, com o
bar fechado e ninguém lançando nada. Por projeto (primeiro o Estimado, depois o
Pico do Mané), a ordem é:

1. **Ensaio** — rodar o script sem `--valendo` e ler a lista do que ele faria.
2. **Valendo** — rodar com `--valendo`. Leva segundos. A partir daqui o app
   ainda está com o código velho e vai mostrar **vazio**: é o relógio correndo.
3. **Juntar no `main`** — a Vercel publica em 1 ou 2 minutos.
4. **Pôr `NEGOCIO_UNICO=<codigo>`** nas configurações daquele projeto e
   republicar.
5. **Conferir** o Dashboard, Finanças e Abastecimento: os números têm que ser
   os mesmos de antes.

A janela de tela vazia é de **uns 3 minutos**. Se algo der errado, o caminho de
volta é um comando:

```
node scripts/mudar-de-casa.mjs --negocio=<codigo> --desfazer --valendo
```

e tirar o `NEGOCIO_UNICO`. O script nunca apaga antes de escrever e conferir, e
o projeto antigo do Pico do Mané fica intacto por semanas de qualquer jeito.

Depois disso, **vender um sistema vira criar um negócio na tela dela**. Sem
Supabase, sem Vercel, sem chave nenhuma.

---

## O que isso não resolve

Dito agora, pra não virar surpresa:

- **Não deixa o PicoOS servir salão de beleza.** Isso é outro assunto (agenda
  por profissional, comissão, serviço no lugar de prato).
- **Não acaba com o custo.** A Saída continua crescendo com o número de clientes.
  O que muda é que vira **uma** assinatura em vez de dez.
- **Junta o risco.** Hoje, um problema derruba um cliente. Depois, derruba todos
  ao mesmo tempo. É o preço do caminho, e é por isso que os testes de vazamento
  e a peça do meio não são negociáveis.

---

## Sobre o histórico do código — decidido

O histórico guarda **5 versões antigas do seed** com os números de verdade do
Pico do Mané (64 receitas, 134 despesas, 89 compras, 149 cotações). **Nenhuma
chave de verdade** — só os textos dos guias e os exemplos.

Olhando de perto, reescrever o histórico é pior do que parecia: exige apagar e
refazer os 179 commits na `main`, e **mesmo assim o GitHub não some com os
pedaços antigos na hora**. Quem já souber o endereço de um commit velho ainda
alcança por um tempo.

**Decisão da Karen: não reescrever.** No dia em que ela for dar acesso do código
a alguém, nasce um repositório novo e limpo, com o código daquele dia num commit
só. É 100% eficaz, não tem risco, e não custa nada enquanto esse dia não chega.
