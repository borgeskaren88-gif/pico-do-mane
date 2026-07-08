import { createClient } from '@supabase/supabase-js';

let cliente = null;

export function supabaseServer() {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltam as variáveis SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  }
  cliente = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cliente;
}
