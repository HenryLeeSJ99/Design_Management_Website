import { ShieldCheck, X } from 'lucide-react';
import styles from './TermsModal.module.css';

export default function TermsModal({ isOpen, onClose, requireAcceptance = false, onAccept }) {
  if (!isOpen) return null;

  const handleAccept = () => {
    localStorage.setItem('tw_terms_accepted', 'true');
    if (onAccept) onAccept();
    if (onClose) onClose();
  };

  return (
    <div className={styles.backdrop} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="terms-title">
        {!requireAcceptance && onClose && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        )}
        <div className={styles.header}>
          <ShieldCheck size={28} className={styles.icon} />
          <h2 id="terms-title">Terms & Conditions</h2>
        </div>
        <div className={styles.content}>
          <p>Welcome to TempWorks Calculators.</p>
          <p>By using these calculators, you agree to the following terms:</p>
          <ul>
            <li><strong>No Liability:</strong> The calculations provided are for reference only. The developer assumes no responsibility for any errors, omissions, or damages resulting from the use of this tool.</li>
            <li><strong>Professional Verification:</strong> All designs must be reviewed and stamped by a qualified Professional Engineer before field implementation.</li>
            <li><strong>Accuracy:</strong> While we strive for accuracy, it is your responsibility to verify all outputs against current codes and standards.</li>
            <li><strong>Global Data Privacy & Compliance:</strong> We process and store data in accordance with international data protection regulations (including GDPR and CCPA). By using this tool, you consent to the global transfer, processing, and storage of your information. You retain the right to access, modify, or request deletion of your data at any time.</li>
          </ul>
          <p>If you do not agree to these terms, please do not use the calculators.</p>
        </div>
        <div className={styles.actions}>
          {requireAcceptance ? (
            <button className={styles.acceptBtn} onClick={handleAccept}>
              I Agree & Continue
            </button>
          ) : (
            <button className={styles.acceptBtn} onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
