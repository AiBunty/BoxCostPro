import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.warn('SUPABASE_URL not configured. Supabase features will be limited.');
}

export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseServiceKey || supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function verifySupabaseToken(token: string) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error) {
      return { user: null, error };
    }
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
}

export async function getSupabaseUserById(userId: string) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) {
      return { user: null, error };
    }
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
}
