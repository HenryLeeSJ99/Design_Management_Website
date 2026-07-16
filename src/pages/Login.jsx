import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldCheck, Calculator } from 'lucide-react';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/projects');
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.brandPanel}>
        <div className={styles.gridBackdrop} aria-hidden="true" />
        <div className={styles.glow} aria-hidden="true" />

        <div className={styles.brandContent}>
          <Logo width={190} light />
          <p className={styles.brandTagline}>
            Temporary works design &amp; verification, built for the site.
          </p>
        </div>

        <svg className={styles.towerArt} viewBox="0 0 360 460" fill="none" aria-hidden="true">
          <rect x="60" y="428" width="32" height="14" rx="2" className={styles.towerMember} />
          <rect x="268" y="428" width="32" height="14" rx="2" className={styles.towerMember} />
          <rect x="60" y="54" width="32" height="14" rx="2" className={styles.towerMember} />
          <rect x="268" y="54" width="32" height="14" rx="2" className={styles.towerMember} />

          <line x1="76" y1="428" x2="76" y2="68" className={styles.towerUpright} strokeWidth="4" strokeLinecap="round" />
          <line x1="284" y1="428" x2="284" y2="68" className={styles.towerUpright} strokeWidth="4" strokeLinecap="round" />

          <line x1="76" y1="128" x2="284" y2="128" className={styles.towerLedger} strokeWidth="3" strokeLinecap="round" />
          <line x1="76" y1="228" x2="284" y2="228" className={styles.towerLedger} strokeWidth="3" strokeLinecap="round" />
          <line x1="76" y1="328" x2="284" y2="328" className={styles.towerLedger} strokeWidth="3" strokeLinecap="round" />

          <path
            d="M76 128 L284 228 M284 128 L76 228"
            className={styles.towerBrace}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ animationDelay: '0.15s' }}
          />
          <path
            d="M76 228 L284 328 M284 228 L76 328"
            className={styles.towerBrace}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ animationDelay: '0.4s' }}
          />
          <path
            d="M76 328 L284 428 M284 328 L76 428"
            className={styles.towerBrace}
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{ animationDelay: '0.65s' }}
          />
        </svg>

        <div className={`${styles.chip} ${styles.chipOne}`}>BS EN 12812</div>
        <div className={`${styles.chip} ${styles.chipTwo}`}>CIRIA 108:1985</div>
        <div className={`${styles.chip} ${styles.chipThree}`}>
          <ShieldCheck size={13} /> Design verified
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.loginBox}>
          <div className={styles.mobileLogo}>
            <Logo width={150} />
          </div>

          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to your TempWorks account</p>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <div className={styles.inputGroup} style={{ '--i': 0 }}>
              <label htmlFor="email">Email</label>
              <div className={styles.inputWrap}>
                <Mail size={16} className={styles.inputIcon} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup} style={{ '--i': 1 }}>
              <label htmlFor="password">Password</label>
              <div className={styles.inputWrap}>
                <Lock size={16} className={styles.inputIcon} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.toggleVisibility}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className={styles.button} style={{ '--i': 2 }}>
              {loading ? (
                <>
                  <Loader2 size={16} className={styles.spinner} /> Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className={styles.divider} style={{ '--i': 3 }}>
            <span>or</span>
          </div>

          <Link to="/calculators/multi-beam" className={styles.secondaryButton} style={{ '--i': 4 }}>
            <Calculator size={16} /> Use calculators online
          </Link>
          <p className={styles.secondaryHint}>No account needed — try a calculator without signing in.</p>
        </div>
      </div>
    </div>
  );
}
