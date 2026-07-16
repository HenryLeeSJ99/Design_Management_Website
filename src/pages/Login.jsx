import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Login.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className={styles.loginBox}>
        <h1 className={styles.title}>TempWorks</h1>
        <p className={styles.subtitle}>Sign in to your account</p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input 
              id="password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
