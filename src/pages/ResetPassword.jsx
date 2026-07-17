import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import AuthPanel from '../components/AuthPanel';
import Logo from '../components/Logo';
import { updatePassword } from '../services/supabaseAuth';
import { supabase } from '../services/supabaseClient';
import styles from './Login.module.css';

const MIN_LENGTH = 8;

/**
 * Where the emailed reset link lands.
 *
 * supabase-js reads the recovery token out of the URL on load and turns it
 * into a session, which is what lets updateUser({password}) work. That happens
 * asynchronously, so this waits for a session before deciding the link is bad —
 * checking immediately would call every valid link expired.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('checking'); // checking | ready | invalid | done
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The recovery session may already be established, or may arrive a beat
    // later once supabase-js has parsed the URL. Listen for both.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session) setStatus('ready');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) { setStatus('ready'); return; }
      // No session yet — give the URL parse a moment before calling it bad.
      setTimeout(() => {
        if (cancelled) return;
        supabase.auth.getSession().then(({ data: { session: later } }) => {
          if (!cancelled) setStatus(later ? 'ready' : 'invalid');
        });
      }, 1200);
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await updatePassword(password);
      setStatus('done');
      // Signed in already via the recovery session, so go straight in rather
      // than making them type the password they just chose.
      setTimeout(() => navigate('/projects'), 1600);
    } catch (err) {
      setError(err.message || 'The password could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <AuthPanel />

      <div className={styles.formPanel}>
        <div className={styles.loginBox}>
          <div className={styles.mobileLogo}><Logo width={150} /></div>

          {status === 'checking' && (
            <>
              <h1 className={styles.title}>One moment</h1>
              <p className={styles.subtitle}>Checking your reset link…</p>
            </>
          )}

          {status === 'invalid' && (
            <>
              <div className={`${styles.sentIcon} ${styles.sentIconWarn}`}><AlertTriangle size={28} /></div>
              <h1 className={styles.title}>This link has expired</h1>
              <p className={styles.subtitle}>
                Reset links last an hour and can only be used once. Request a fresh one and it will
                work.
              </p>
              <Link to="/forgot-password" className={styles.button} style={{ marginTop: '1.25rem' }}>
                Send a new link
              </Link>
              <Link to="/login" className={styles.backToSignIn}>
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </>
          )}

          {status === 'done' && (
            <>
              <div className={`${styles.sentIcon} ${styles.sentIconOk}`}><Check size={28} /></div>
              <h1 className={styles.title}>Password updated</h1>
              <p className={styles.subtitle}>Signing you in…</p>
            </>
          )}

          {status === 'ready' && (
            <>
              <h1 className={styles.title}>Set a new password</h1>
              <p className={styles.subtitle}>At least {MIN_LENGTH} characters.</p>

              <form onSubmit={handleSubmit} className={styles.form} noValidate>
                {error && <div className={styles.error} role="alert">{error}</div>}

                <div className={styles.inputGroup} style={{ '--i': 0 }}>
                  <label htmlFor="password">New password</label>
                  <div className={styles.inputWrap}>
                    <Lock size={16} className={styles.inputIcon} />
                    <input
                      id="password"
                      type={show ? 'text' : 'password'}
                      autoComplete="new-password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className={styles.toggleVisibility}
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? 'Hide password' : 'Show password'}
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {tooShort && <span className={styles.fieldError}>Needs at least {MIN_LENGTH} characters.</span>}
                </div>

                <div className={styles.inputGroup} style={{ '--i': 1 }}>
                  <label htmlFor="confirm">Confirm new password</label>
                  <div className={styles.inputWrap}>
                    <Lock size={16} className={styles.inputIcon} />
                    <input
                      id="confirm"
                      type={show ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>
                  {mismatch && <span className={styles.fieldError}>These do not match.</span>}
                </div>

                <button type="submit" disabled={!canSubmit} className={styles.button} style={{ '--i': 2 }}>
                  {saving
                    ? <><Loader2 size={16} className={styles.spinner} /> Updating…</>
                    : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
