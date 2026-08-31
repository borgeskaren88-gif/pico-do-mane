-- Execute este SQL no Supabase: seu projeto → SQL Editor → New query → colar → Run

-- 1) Tabela dos lançamentos (gastos e entradas) do casal.
create table if not exists financas_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'despesa',   -- 'despesa' (gasto) ou 'receita' (entrada)
  valor numeric not null,                  -- valor em reais
  categoria text,                          -- ex.: Mercado, Transporte...
  descricao text,                          -- observação opcional
  data date not null,                      -- dia do gasto/entrada
  usuario text not null,                   -- nome de quem lançou
  criado_em timestamptz not null default now()
);
create index if not exists idx_financas_data on financas_lancamentos (data);
alter table financas_lancamentos enable row level security;

-- 2) Tabela "chave-valor" para hábitos e lista de compras.
--    Guarda tudo num único registro (chave 'casa'), em formato JSON.
create table if not exists casa_dados (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table casa_dados enable row level security;

-- Segurança: as duas tabelas bloqueiam acesso direto pelo navegador.
-- Só o backend (com a Service Role Key, que fica só no servidor) lê/escreve.
