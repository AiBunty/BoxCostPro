// Supabase integration removed for direct Google OAuth mode.
// This file exports safe stubs to preserve the previous API surface
// so code importing these helpers does not break when Supabase is not used.

export const supabaseAdmin = null as any;

export async function verifySupabaseToken(_token: string) {
  return { user: null, error: new Error('Supabase disabled') };
}

export async function getSupabaseUserById(_userId: string) {
  return { user: null, error: new Error('Supabase disabled') };
}
