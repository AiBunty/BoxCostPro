// Client-side supabase helper — when VITE_SUPABASE_* is not provided
// we export safe fallbacks that use the server session endpoints and
// direct Google OAuth redirect to keep the client working without Supabase.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
export const supabase = null as any;

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
  return { data: null, error: new Error('Supabase not configured') };
}

export async function signInWithMagicLink(email: string) {
  return { data: null, error: new Error('Supabase not configured') };
}

export async function signInWithPassword(email: string, password: string) {
  return { data: null, error: new Error('Supabase not configured') };
}

export async function signUpWithPassword(email: string, password: string, metadata?: { fullName?: string }) {
  return { data: null, error: new Error('Supabase not configured') };
}

export async function resetPassword(email: string) {
  return { data: null, error: new Error('Supabase not configured') };
}

export async function updatePassword(newPassword: string) {
  return { data: null, error: new Error('Supabase not configured') };
}

export async function verifyOTP(email: string, token: string) {
  return { data: null, error: new Error('Supabase not configured') };
}

export async function signInWithGoogle() {
  // Redirect to server-side direct Google OAuth endpoint
  try {
    window.location.href = '/api/auth/google/login';
    return { data: null, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export async function signOut() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (!res.ok) throw new Error('Logout failed');
    return { error: null };
  } catch (err: any) {
    return { error: err };
  }
}

export async function getCurrentUser() {
  try {
    const res = await fetch('/api/auth/user');
    if (!res.ok) return { user: null, error: new Error('No session') };
    const user = await res.json();
    return { user, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

export async function getSession() {
  try {
    const res = await fetch('/api/auth/user');
    if (!res.ok) return { session: null, error: new Error('No session') };
    const user = await res.json();
    return { session: user, error: null };
  } catch (err: any) {
    return { session: null, error: err };
  }
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  // No-op subscription for session-based fallback
  const sub = { unsubscribe: () => {} };
  return { data: { subscription: sub } };
}
