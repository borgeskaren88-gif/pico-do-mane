# Ligar o pagamento automático (Asaas)

> **Situação (22/11/2026):** conta criada, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` salvas no projeto **picoos** (Production), webhook "PicoOS" ativo no Asaas com os eventos de cobrança recebida e confirmada. Falta só testar o "Assinar" com um bar de teste.

O cadastro sozinho já funciona **sem isto**: a pessoa cria o bar e ganha 14 dias.
Enquanto o pagamento não estiver ligado, o botão "Assinar" mostra o teu WhatsApp.

Para a pessoa conseguir **pagar sozinha** (e o app liberar sozinho), faz isto **uma vez**:

## 1. Criar a conta no Asaas
- Entra em asaas.com e cria a conta (CPF ou CNPJ teu). Não tem mensalidade.
- Manda os documentos que ele pedir para aprovar a conta.

## 2. Pegar a chave e colar na Vercel (tu mesma, nunca por mensagem)
- No Asaas: **Integrações → Chaves de API → Gerar chave**. Copia.
- Na Vercel: o projeto do PicoOS (o do endereço pico-do-mane.vercel.app) → **Settings → Environment Variables** → adiciona
  - Nome: `ASAAS_API_KEY` · Valor: a chave que copiaste.
- ⚠️ Não manda essa chave por WhatsApp, foto, nota, nem para o Claude. Vai direto do Asaas para a Vercel.

## 3. Criar o aviso de pagamento (webhook)
- No Asaas: **Integrações → Webhooks → Criar Webhook**
  - URL: `https://pico-do-mane.vercel.app/api/assinatura/webhook`
  - Token de autenticação: toca em **Gerar token** e copia
  - Eventos: **Cobrança recebida** e **Cobrança confirmada** (`PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`)
- Na Vercel, adiciona mais uma variável:
  - Nome: `ASAAS_WEBHOOK_TOKEN` · Valor: o token que copiaste (igual nos dois lugares).

## 4. Publicar de novo
- Na Vercel: **Deployments → os três pontinhos do último → Redeploy**. Pronto.

## Quer testar antes com dinheiro de mentira?
- Usa uma conta do **Asaas Sandbox** (sandbox.asaas.com), faz os passos 2 e 3 com ela,
  e adiciona também `ASAAS_SANDBOX` = `1`. Quando estiver tudo certo, troca a chave e o
  token pelos da conta de verdade e apaga a `ASAAS_SANDBOX`.

## Como funciona depois
- Cada bar novo: 14 dias grátis → assina pelo app → paga no Pix, boleto ou cartão.
- O Asaas avisa o PicoOS e o mês é liberado sozinho.
- Atrasou: 5 dias de carência com aviso vermelho; depois o app pausa (os dados ficam).
- Na tua sala de máquinas (`/admin`): quem está em teste, quem pagou, quem atrasou,
  o preço, fechar o cadastro, dar mais dias e isentar.
- O Pico do Mané não tem cobrança e nunca fecha.

## Lembrete de custo
- Quando começares a cobrar, a Vercel exige o plano **Pro** (US$ 20/mês): o grátis é só para uso não comercial.
