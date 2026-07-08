import { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import styles from './Login.module.css';

export default function Login() {
  const emailRef = useRef();
  const passwordRef = useRef();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, emailRef.current.value, passwordRef.current.value);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          role: 'Engineer'
        });
      } else {
        await login(emailRef.current.value, passwordRef.current.value);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(isRegistering ? 'Failed to create an account: ' + err.message : 'Failed to log in: ' + err.message);
    }
    setLoading(false);
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.logoContainer}>
          <h1 className={styles.logoTitle}>TempWorks</h1>
          <p className={styles.logoSubtitle}>Design Management System</p>
        </div>
        <h2 className={styles.loginHeader}>{isRegistering ? 'Create Account' : 'Sign In'}</h2>
        {error && <div className={styles.errorAlert}>{error}</div>}
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input type="email" ref={emailRef} required />
          </div>
          <div className={styles.formGroup}>
            <label>Password</label>
            <input type="password" ref={passwordRef} required />
          </div>
          <button disabled={loading} className={styles.loginButton} type="submit">
            {isRegistering ? 'Sign Up' : 'Log In'}
          </button>
        </form>
        <div className={styles.toggleText}>
          {isRegistering ? 'Already have an account? ' : 'Need an account? '}
          <button type="button" onClick={() => setIsRegistering(!isRegistering)} className={styles.toggleBtn}>
            {isRegistering ? 'Log In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
