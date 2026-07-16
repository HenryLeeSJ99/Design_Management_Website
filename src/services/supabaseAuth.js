import { supabase } from './supabaseClient';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleData, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  // If there's an error (e.g., table doesn't exist yet or user not found), default to 'designer'
  if (error) {
    console.warn('Could not fetch user role, defaulting to designer:', error.message);
  }

  return { ...user, role: roleData?.role || 'designer' };
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      // Re-fetch the profile to include the role
      const profile = await getUserProfile();
      callback(event, profile);
    } else {
      callback(event, null);
    }
  });
  return () => subscription.unsubscribe();
}
