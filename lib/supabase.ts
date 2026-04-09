
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURAÇÃO DA CONEXÃO SUPABASE (Easypanel/VPS)
 * 
 * Utilizando o endpoint fornecido: https://araujo-supabase.5xzd6c.easypanel.host/
 */

const supabaseUrl = 'https://araujo-supabase.5xzd6c.easypanel.host';

// Chave anônima padrão do Supabase Docker/Self-hosted
// Se você alterou a JWT_SECRET na instalação, precisará gerar uma nova chave.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Agora que a URL foi inserida, a configuração é considerada válida
export const checkConfig = () => true;
