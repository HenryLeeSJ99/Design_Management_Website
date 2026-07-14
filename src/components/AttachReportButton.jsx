import { useState } from 'react';
import { CheckCircle2, Loader2, Paperclip } from 'lucide-react';
import { renderReportPdfBlob } from '../utils/reportPdf';
import {
  getCurrentDesign,
  listCalculations,
  saveCalculation,
  setCurrentDesign,
  setItemPdf,
} from '../services/projectStore';
import { deletePdf, generatePdfId, putPdf } from '../services/pdfStore';
import styles from './AttachReportButton.module.css';

/**
 * "Attach Report to Project" — the only way report PDFs enter the project.
 * In one action it (1) saves/updates the calculation snapshot in the project
 * and (2) renders the Report DOM to PDF and attaches it, so the stored
 * design and its report can never drift apart.
 *
 * @param calculator  slug identifying the calculator ('multi-beam', …)
 * @param title       human name, used for the default design name
 * @param sessionKeys sessionStorage keys that make up a design snapshot
 * @param reportRef   ref to the report container DOM node
 * @param disabled    disable while there are no results to report
 */
export default function AttachReportButton({ calculator, title, sessionKeys, reportRef, disabled }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const collectSnapshot = () => {
    const data = {};
    sessionKeys.forEach((key) => {
      const raw = sessionStorage.getItem(key);
      if (raw != null) data[key] = raw;
    });
    return data;
  };

  const handleAttach = async () => {
    if (!reportRef?.current) {
      setError('The report is not ready yet.');
      return;
    }
    setError('');
    setDone(false);

    // Which project calculation does this report belong to?
    const marker = getCurrentDesign(calculator);
    const existing = marker?.id
      ? listCalculations(calculator).find((d) => d.id === marker.id) || null
      : null;
    let name = existing?.name;
    if (!existing) {
      name = window.prompt(
        'Save this calculation to the project as:',
        `${title} — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      );
      if (!name || !name.trim()) return; // cancelled
      name = name.trim();
    }

    setBusy(true);
    try {
      // 1. Save the design snapshot so data and report always match
      const id = saveCalculation({ id: existing?.id, name, calculator, data: collectSnapshot() });
      setCurrentDesign(calculator, { id, name });

      // 2. Render the report to PDF and attach it, replacing any older one
      const blob = await renderReportPdfBlob(reportRef.current);
      const bytes = await blob.arrayBuffer();
      if (existing?.pdfId) await deletePdf(existing.pdfId).catch(() => {});
      const pdfId = generatePdfId();
      await putPdf(pdfId, bytes);
      setItemPdf(id, { pdfId, pdfName: `${name}.pdf`, pdfSize: bytes.byteLength });

      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch (e) {
      setError(e.message || 'Failed to attach the report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={`${styles.btn} ${done ? styles.done : ''}`}
        onClick={handleAttach}
        disabled={disabled || busy}
        title="Save this calculation and attach its report PDF to the Project Dashboard"
      >
        {busy ? <Loader2 size={15} className={styles.spin} /> : done ? <CheckCircle2 size={15} /> : <Paperclip size={15} />}
        {busy ? 'Attaching…' : done ? 'Report attached' : 'Attach Report to Project'}
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </span>
  );
}
