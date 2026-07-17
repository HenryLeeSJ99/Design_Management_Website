import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, MailCheck } from 'lucide-react';
import AuthPanel from '../components/AuthPanel';
import Logo from '../components/Logo';
import { requestPasswordReset } from '../services/supabaseAuth';
import styles from './Login.module.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      // Only genuine failures land here — a bad rate limit, a network drop.
      // An unknown address is NOT an error: see the success copy below.
      setError(err.message || 'The reset email could not be sent.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <AuthPanel />

      <div className={styles.formPanel}>
        <div className={styles.loginBox}>
          <div className={styles.mobileLogo}>
            <Logo width={150} />
          </div>

          {sent ? (
            <>
              <div className={styles.sentIcon}><MailCheck size={28} /></div>
              <h1 className={styles.title}>Check your inbox</h1>
              {/* Deliberately says "if there is an account" rather than
                  confirming one exists. Otherwise this form becomes a way to
                  find out which colleagues are registered. */}
              <p className={styles.subtitle}>
                If there is an account for <strong>{email.trim()}</strong>, a link to set a new
                password is on its way. It expires in an hour.
              </p>
              <p className={styles.secondaryHint}>
                Nothing arrived? Check spam, or try again in a few minutes — repeated requests are
                rate limited.
              </p>
              <Link to="/login" className={styles.secondaryButton} style={{ marginTop: '1.25rem' }}>
                <ArrowLeft size={16} /> Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className={styles.title}>Forgot your password?</h1>
              <p className={styles.subtitle}>
                Enter your email and we&apos;ll send you a link to set a new one.
              </p>

              <form onSubmit={handleSubmit} className={styles.form} noValidate>
                {error && <div className={styles.error} role="alert">{error}</div>}

                <div className={styles.inputGroup} style={{ '--i': 0 }}>
                  <label htmlFor="email">Email</label>
                  <div className={styles.inputWrap}>
                    <Mail size={16} className={styles.inputIcon} />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className={styles.button}
                  style={{ '--i': 1 }}
                >
                  {loading
                    ? <><Loader2 size={16} className={styles.spinner} /> Sending…</>
                    : 'Send reset link'}
                </button>
              </form>

              <Link to="/login" className={styles.backToSignIn}>
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
