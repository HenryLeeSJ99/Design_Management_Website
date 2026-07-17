import Logo from './Logo';
import { ShieldCheck } from 'lucide-react';
import styles from '../pages/Login.module.css';

/**
 * The dark brand half of the auth pages.
 *
 * Extracted when forgot-password and reset-password arrived: three copies of
 * the same animated tower SVG would drift apart the first time anyone touched
 * one. Shares Login.module.css rather than duplicating the styles — the panel
 * and the form card are one design, and splitting the CSS would let them
 * diverge for no benefit.
 */
export default function AuthPanel() {
  return (
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

        <path d="M76 128 L284 228 M284 128 L76 228" className={styles.towerBrace} strokeWidth="2.5" strokeLinecap="round" style={{ animationDelay: '0.15s' }} />
        <path d="M76 228 L284 328 M284 228 L76 328" className={styles.towerBrace} strokeWidth="2.5" strokeLinecap="round" style={{ animationDelay: '0.4s' }} />
        <path d="M76 328 L284 428 M284 328 L76 428" className={styles.towerBrace} strokeWidth="2.5" strokeLinecap="round" style={{ animationDelay: '0.65s' }} />
      </svg>

      <div className={`${styles.chip} ${styles.chipOne}`}>BS EN 12812</div>
      <div className={`${styles.chip} ${styles.chipTwo}`}>CIRIA 108:1985</div>
      <div className={`${styles.chip} ${styles.chipThree}`}>
        <ShieldCheck size={13} /> Design verified
      </div>
    </div>
  );
}
