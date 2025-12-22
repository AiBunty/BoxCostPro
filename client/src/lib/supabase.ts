import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl.startsWith('http') && supabaseAnonKey.length > 10;

let supabaseInstance: SupabaseClient | null = null;

if (isConfigured) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
} else {
  console.warn('Supabase credentials not configured. Using fallback authentication.');
}

export const supabase = supabaseInstance;
export const isSupabaseConfigured = isConfigured;

export type AuthUser = {
  id: string;
  email: string | undefined;
  phone: string | undefined;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
    first_name?: string;
    last_name?: string;
  };
};

export async function signInWithOTP(email: string) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
  return { data, error };
}

export async function signInWithMagicLink(email: string) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signUpWithPassword(email: string, password: string, metadata?: { fullName?: string }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: metadata?.fullName,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

export async function resetPassword(email: string) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  return { data, error };
}

export async function updatePassword(newPassword: string) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}

export async function verifyOTP(email: string, token: string) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  return { data, error };
}

export async function signInWithGoogle() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not configured') };
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

export async function signOut() {
  if (!supabase) {
    return { error: new Error('Supabase not configured') };
  }
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  if (!supabase) {
    return { user: null, error: new Error('Supabase not configured') };
  }
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function getSession() {
  if (!supabase) {
    return { session: null, error: new Error('Supabase not configured') };
  }
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  if (!supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}
