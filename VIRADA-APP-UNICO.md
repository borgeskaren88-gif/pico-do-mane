# A virada: juntar os dois num app só

Roteiro para executar **com o bar fechado**. Uns 30 minutos.

> **Por que agora dá pra fazer do jeito fácil:** o Estimado tem 2 linhas e as
> duas estão vazias. Não há nada dele para mover. Então o banco compartilhado
> passa a ser **o do Pico do Mané**, e os 407 registros da Karen **não saem do
> lugar**. É o caminho de menor risco que existe.

---

## Antes de começar, à mão

- [ ] A senha da **sala de máquinas** (longa, só tua, não usada em outro lugar)
- [ ] A senha que vai ser a da **dona do Pico do Mané** (pode ser a de hoje)
- [ ] A senha que vai ser a da **dona do Estimado** (nova, pra mandar pra eles)

---

## A — Ligar a sala de máquinas · 5 min

1. Vercel → **teu projeto** → Settings → Environments → **Production** →
   **Add Environment Variable**

   | campo | valor |
   |---|---|
   | Key | `ADMIN_PASSWORD` |
   | Value | a senha da sala de máquinas |
   | Type | **Secret** ← esta é senha de verdade |
   | Ambientes | Production + Preview |

2. **Confere o nome antes de salvar.** Foi aqui que a gente perdeu dez minutos
   na última vez (`NEGCIO_UNICO`, sem o O). Nome de variável não se edita depois
   de criada — apaga e cria de novo.

3. Deployments → **Redeploy**

Nada muda para ninguém. Só passa a existir o endereço `/admin`.

---

## B — Criar os dois negócios · 5 min

4. Abre o teu endereço com **`/admin`** no fim. Entra com a `ADMIN_PASSWORD`.

5. Cria os dois:

   | código | nome | senha |
   |---|---|---|
   | `pico-do-mane` | Pico do Mané | a tua |
   | `estimado` | Estimado | a nova, pra mandar |

   ⚠️ Criar o `pico-do-mane` **não toca nos dados**. Só cria o registro e guarda
   a senha. Os 407 registros ficam onde estão.

   A tela mostra, uma vez só, o que mandar para cada pessoa. Copia antes de
   fechar.

---

## C — Virar · 5 min

6. Vercel → **apaga** a variável `NEGOCIO_UNICO`
7. Settings → General → **renomeia o projeto** para `picoos`
   (se estiver em uso: `picoos-app` ou `meupicoos`)
8. **Redeploy**

---

## D — Conferir · 10 min

- [ ] `picoos.vercel.app` abre, e a tela de entrada pede **código do negócio**
- [ ] Código `pico-do-mane` + senha → **Dashboard, Receitas e Estoque iguais ao de antes**
- [ ] Código `estimado` + senha → abre **vazio**, na tela de boas-vindas
- [ ] Links novos do **Google Agenda** e do **widget**, pegos dentro do app e reconectados
- [ ] **Configurações → Acessos**: senhas da equipe trocadas
      (podem ter voltado ao `1234` — o app avisa na tela até trocar)
- [ ] Ícone reinstalado no iPad e nos celulares

Se o Dashboard abrir **vazio**, não é perda de dado: é o código do negócio
escrito diferente do que está no banco. Para conferir, no SQL Editor:

```sql
select count(*) filter (where chave like 'n:pico-do-mane:%') as certas,
       count(*) as total
from pdm_dados;
```

Os dois números têm que ser iguais.

---

## E — Limpar · 5 min

9. Apaga o projeto `picoos-estimado` na **Vercel**
10. Apaga o projeto `estimado` no **Supabase** → ✅ **libera um projeto grátis**
11. Avisa o pessoal do Estimado: endereço novo, código `estimado`, senha nova

---

## O que muda para as pessoas

- **O endereço muda para todo mundo.** Quem tem o app na tela inicial precisa
  apagar e pôr de novo. Uma vez só.
- **Passa a existir um código** na tela de entrada. Fica guardado no aparelho;
  digita uma vez.
- **O nome do negócio some da tela de entrada.** É de propósito: num app de
  muitos, mostrar o nome deixaria qualquer um na internet descobrir quem são os
  clientes. O nome aparece depois de entrar.

---

## Se precisar voltar atrás

Antes do passo C, é só apagar os dois negócios na sala de máquinas.

Depois do passo C: repõe `NEGOCIO_UNICO=pico-do-mane` na Vercel e republica. Os
dados nunca saíram do lugar, então não há nada a restaurar.

---

## Quando terminar

Um app, dois negócios dentro, e o terceiro cliente passa a ser **um formulário**
— sem Supabase, sem Vercel, sem chave nenhuma.

O que ainda falta antes do primeiro cliente **pagante** está em
`MAPA-APP-UNICO.md`: os planos pagos (a Vercel Hobby não cobre uso comercial), o
preço, e o ensaio da sala de máquinas com um negócio de mentira.
