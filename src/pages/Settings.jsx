import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import styles from './Settings.module.css';
import { User, Mail, Shield, Save, CheckCircle } from 'lucide-react';

export default function Settings() {
  const { user, role } = useAuth();
  
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Initialize form with current data
  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name || '');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() }
      });
      
      if (updateError) throw updateError;
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>Settings</h1>
          <p className={styles.subtitle}>Manage your account information and preferences.</p>
        </div>
      </header>

      <div className={styles.content}>
        <form onSubmit={handleSubmit} className={styles.formCard}>
          <h2 className={styles.cardTitle}>Profile Information</h2>
          
          {error && <div className={styles.errorBanner}>{error}</div>}
          
          <div className={styles.formGroup}>
            <label htmlFor="display_name">
              <User size={16} /> Display Name
            </label>
            <input
              id="display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className={styles.input}
              disabled={loading}
            />
            <p className={styles.helpText}>This is how your name will appear to others.</p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email">
              <Mail size={16} /> Email Address
            </label>
            <input
              id="email"
              type="email"
              value={user?.email || ''}
              className={styles.input}
              disabled
            />
            <p className={styles.helpText}>Your email address is managed by your administrator.</p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="role">
              <Shield size={16} /> System Role
            </label>
            <div>
              <span className={styles.roleBadge}>
                {role ? role.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
              </span>
            </div>
            <p className={styles.helpText}>Your access level determines what projects you can view and edit.</p>
          </div>

          <div className={styles.actions}>
            <button 
              type="submit" 
              className={styles.btnPrimary} 
              disabled={loading || !displayName.trim() || displayName === user?.user_metadata?.display_name}
            >
              {loading ? 'Saving...' : (
                <>
                  {success ? <CheckCircle size={18} /> : <Save size={18} />}
                  {success ? 'Saved!' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
