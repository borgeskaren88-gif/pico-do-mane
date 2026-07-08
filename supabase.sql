-- Execute este SQL no Supabase: seu projeto → SQL Editor → New query → colar → Run

create table if not exists pdm_dados (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Segurança: bloqueia qualquer acesso direto vindo do navegador.
-- Só o backend (usando a Service Role Key, que fica só no servidor) consegue ler/escrever.
alter table pdm_dados enable row level security;
