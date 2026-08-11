-- Execute este SQL no Supabase: seu projeto → SQL Editor → New query → colar → Run
-- Cria a tabela onde ficam guardados os lançamentos (gastos e entradas) do casal.

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

-- Índice para buscar rápido por mês/dia.
create index if not exists idx_financas_data on financas_lancamentos (data);

-- Segurança: bloqueia qualquer acesso direto vindo do navegador.
-- Só o backend (usando a Service Role Key, que fica só no servidor) consegue ler/escrever.
alter table financas_lancamentos enable row level security;
