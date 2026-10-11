#!/bin/sh
# Semeia o banco de mentira e roda cada teste do zero.
#
# Reseme ANTES DE CADA UM, de propósito: teste que depende do que o anterior
# deixou passa em ordem e falha sozinho, e aí ninguém confia em nenhum dos dois.
#
# LAB_MARCA é o prefixo do negócio depois da mudança de casa ("n:pico-do-mane:").
# Os testes leem o banco direto pra conferir, e sem a marca procurariam chave
# que não existe mais.
AQUI=$(dirname "$0")
for t in "$@"; do
  pkill -f "[p]grest.mjs" >/dev/null 2>&1
  sleep 1
  LAB_SEED="$AQUI/seed.json" LAB_PORT=54321 nohup node "$AQUI/pgrest.mjs" > "$AQUI/pg.log" 2>&1 &
  sleep 2
  SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=chave-de-mentira \
    node "$AQUI/../scripts/mudar-de-casa.mjs" --negocio=pico-do-mane --valendo > /dev/null 2>&1
  printf '\n===== %s\n' "$t"
  LAB_MARCA="n:pico-do-mane:" node "$t" 2>&1
done
