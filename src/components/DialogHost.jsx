/**
 * DialogHost.jsx
 * Renders the app's confirm/prompt dialogs. Mounted once at the root; the
 * dialog service feeds it one request at a time and it resolves the caller's
 * promise when the user acts.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { resolveDialog, subscribeDialog } from '../services/dialog';
import styles from './DialogHost.module.css';

export default function DialogHost() {
  const [spec, setSpec] = useState(null);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => subscribeDialog((next) => {
    setSpec(next);
    setValue(next.kind === 'prompt' ? (next.defaultValue ?? '') : '');
  }), []);

  // Focus the input (selected) or the confirm button when a dialog opens
  useEffect(() => {
    if (!spec) return;
    const id = requestAnimationFrame(() => {
      if (spec.kind === 'prompt') inputRef.current?.select();
      else inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [spec]);

  if (!spec) return null;

  const close = (result) => {
    setSpec(null);
    resolveDialog(result);
  };

  const cancel = () => close(spec.kind === 'prompt' ? null : false);
  const confirm = () => {
    if (spec.kind === 'prompt') {
      const trimmed = value.trim();
      close(trimmed || null); // blank is a cancel, so callers need not re-check
    } else {
      close(true);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    // Enter confirms from the text field; in a plain confirm the button owns it
    if (e.key === 'Enter' && spec.kind === 'prompt') { e.preventDefault(); confirm(); }
  };

  const isPrompt = spec.kind === 'prompt';
  const danger = !!spec.danger;

  return (
    <div className={styles.backdrop} onClick={cancel} role="presentation">
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={spec.title || (isPrompt ? 'Enter a value' : 'Confirm')}
      >
        <div className={styles.body}>
          {danger && (
            <div className={styles.dangerIcon}><AlertTriangle size={20} /></div>
          )}
          <div className={styles.content}>
            {spec.title && <h2 className={styles.title}>{spec.title}</h2>}
            {/* pre-line keeps any \n a caller wrote into the message */}
            {spec.message && <p className={styles.message}>{spec.message}</p>}

            {isPrompt && (
              <label className={styles.field}>
                {spec.label && <span>{spec.label}</span>}
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  placeholder={spec.placeholder || ''}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btnCancel} onClick={cancel}>
            {spec.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            ref={isPrompt ? undefined : inputRef}
            className={danger ? styles.btnDanger : styles.btnConfirm}
            onClick={confirm}
          >
            {spec.confirmLabel || (isPrompt ? 'OK' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
