/**
 * CoverPreview.jsx
 * Renders the title page exactly as it will print, without compiling the whole
 * package. Built from the stored cover, so it shows what is saved — if the
 * preview is right, the compiled cover is right.
 */

import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { getProject } from '../services/projectStore';
import styles from './CoverPreview.module.css';

export default function CoverPreview({ onClose }) {
  const canvasRef = useRef(null);
  const bytesRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { compileCoverPdf } = await import('../services/pdfCompile');
        const bytes = await compileCoverPdf(getProject());
        if (cancelled) return;
        bytesRef.current = bytes;

        const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        // pdf.js takes ownership of the buffer, so never hand it the original
        const doc = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        const page = await doc.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(760 / base.width, (window.innerHeight - 220) / base.height);
        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          ...(dpr === 1 ? {} : { transform: [dpr, 0, 0, dpr, 0, 0] }),
        }).promise;
        if (!cancelled) setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Could not render the cover page.');
        setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Escape closes, as in any modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = () => {
    if (!bytesRef.current) return;
    const blob = new Blob([bytesRef.current], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cover-page.pdf';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cover page preview">
        <header className={styles.head}>
          <div>
            <h2>Cover page preview</h2>
            <p>Page 1 of the compiled PDF</p>
          </div>
          <div className={styles.headActions}>
            <button type="button" className={styles.btnSecondary} onClick={handleDownload} disabled={status !== 'ready'}>
              <Download size={14} /> Download
            </button>
            <button type="button" className={styles.iconBtn} onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className={styles.body}>
          {status === 'loading' && <p className={styles.msg}>Rendering…</p>}
          {status === 'error' && <p className={styles.err}>{error}</p>}
          <canvas ref={canvasRef} className={styles.canvas} hidden={status !== 'ready'} />
        </div>
      </div>
    </div>
  );
}
