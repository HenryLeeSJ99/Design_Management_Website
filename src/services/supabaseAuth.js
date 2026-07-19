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

/**
 * Email someone a link to set a new password.
 *
 * `redirectTo` must be listed under Auth → URL Configuration → Redirect URLs
 * in the Supabase dashboard, or the link in the email silently refuses to
 * land. Built from window.location.origin so it works on localhost and on
 * the deployed host without a per-environment constant.
 *
 * Deliberately does NOT report whether the address has an account: that would
 * turn this form into a way to test which of your colleagues' emails are
 * registered. Supabase does not distinguish either — the caller shows the
 * same "check your inbox" message regardless.
 */
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/**
 * Set a new password for whoever the current recovery session belongs to.
 *
 * Only works while the session established by the emailed link is live —
 * supabase-js picks that up from the URL when the page loads. Without it this
 * throws rather than silently doing nothing, which is what the reset page
 * relies on to tell a stale or reused link from a good one.
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
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

  // FAIL CLOSED. If the role cannot be determined — a query error, or no row —
  // the role is null, NOT 'designer'. The old default handed anyone whose
  // lookup hiccupped a writing role, which showed them the design workbook and
  // let them attempt saves the database would then refuse. (Postgres RLS is
  // the real gate and already denies writes for an unknown role, so this was
  // never a breach — but the UI implied access that wasn't there.) A null role
  // shows the least: no workbook, no privileged actions. See canUseWorkbook().
  if (error) {
    console.warn('Could not determine user role — treating as no privileges:', error.message);
  }

  return { ...user, role: roleData?.role || null };
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
