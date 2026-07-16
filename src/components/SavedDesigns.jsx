import { useRef, useState } from 'react';
import { Download, FolderOpen, FolderPlus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import {
  applySnapshot,
  clearItemPdf,
  deleteCalculation,
  exportCalculationFile,
  listCalculations,
  parseCalculationFile,
  readJsonFile,
  saveCalculation,
  setCurrentDesign,
  CALCULATORS,
} from '../services/projectStore';
import { deletePdf } from '../services/pdfStore';
import { confirmDialog } from '../services/dialog';
import { useCalcReset } from './CalcInstance';
import styles from './SavedDesigns.module.css';

const formatWhen = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/**
 * Save/load panel for a calculator. Designs are stored in the local project
 * (visible on the Project Dashboard) and can be exported to / imported from
 * .json files.
 *
 * @param calculator  slug identifying the calculator ('multi-beam', …)
 * @param title       human name shown in the panel header
 * @param sessionKeys sessionStorage keys that make up a design snapshot
 */
export default function SavedDesigns({ calculator, title, sessionKeys }) {
  const resetCalculator = useCalcReset();
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = () => setDesigns(listCalculations(calculator));

  const openPanel = () => {
    setError('');
    setNotice('');
    refresh();
    setOpen(true);
  };

  const collectSnapshot = () => {
    const data = {};
    sessionKeys.forEach((key) => {
      const raw = sessionStorage.getItem(key);
      if (raw != null) data[key] = raw;
    });
    return data;
  };

  const handleSaveToProject = async (existing) => {
    const designName = existing ? existing.name : name.trim();
    setError('');
    setNotice('');
    if (!designName) {
      setError('Give the design a name first.');
      return;
    }
    const id = saveCalculation({
      id: existing?.id,
      name: designName,
      calculator,
      data: collectSnapshot(),
    });
    setCurrentDesign(calculator, { id, name: designName });
    // The design data changed, so a previously attached report no longer
    // matches it — drop it; the Report tab re-attaches a fresh one.
    if (existing?.pdfId) {
      await deletePdf(existing.pdfId).catch(() => {});
      clearItemPdf(existing.id);
    }
    setName('');
    refresh();
    setNotice(
      existing
        ? `"${designName}" updated${existing.pdfId ? ' — attached report cleared; re-attach it from the Report tab' : ''}.`
        : `"${designName}" saved to the project.`,
    );
  };

  const handleExportFile = () => {
    setError('');
    setNotice('');
    exportCalculationFile({
      name: name.trim() || title,
      calculator,
      data: collectSnapshot(),
    });
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setError('');
    setNotice('');
    try {
      const parsed = parseCalculationFile(await readJsonFile(file));
      if (parsed.calculator !== calculator) {
        const owner = CALCULATORS[parsed.calculator]?.title || parsed.calculator;
        throw new Error(`This file belongs to the ${owner} calculator — open it there or import it on the Project Dashboard.`);
      }
      applySnapshot(calculator, parsed.data);
      setOpen(false);
      resetCalculator(); // remount → calculator rehydrates from sessionStorage
    } catch (e) {
      setError(e.message || 'Failed to import the file.');
    }
  };

  const handleLoad = (design) => {
    applySnapshot(calculator, design.data);
    setCurrentDesign(calculator, { id: design.id, name: design.name });
    setOpen(false);
    resetCalculator();
  };

  const handleDelete = async (design) => {
    const ok = await confirmDialog({
      title: 'Delete design',
      message: `Delete "${design.name}" from the project? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    deleteCalculation(design.id);
    if (design.pdfId) await deletePdf(design.pdfId).catch(() => {});
    refresh();
  };

  return (
    <>
      <button type="button" className={styles.trigger} onClick={openPanel}>
        <FolderOpen size={16} /> Designs
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label={`Designs — ${title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.panelHeader}>
              <h3>Designs · {title}</h3>
              <button type="button" className={styles.iconBtn} onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className={styles.saveRow}>
              <input
                type="text"
                value={name}
                placeholder="Name this design (e.g. Tower B — L3 slab)"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveToProject(null); }}
              />
              <button type="button" className={styles.saveBtn} onClick={() => handleSaveToProject(null)}>
                <FolderPlus size={15} /> Save to project
              </button>
            </div>

            <div className={styles.fileRow}>
              <button type="button" className={styles.fileBtn} onClick={handleExportFile}>
                <Download size={14} /> Export .json file
              </button>
              <button type="button" className={styles.fileBtn} onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} /> Load from file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {notice && <div className={styles.notice}>{notice}</div>}

            <div className={styles.list}>
              {designs.length === 0 && (
                <div className={styles.emptyState}>
                  No saved designs for this calculator yet — save the current one above.
                </div>
              )}
              {designs.map((design) => (
                <div key={design.id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{design.name}</span>
                    <span className={styles.itemDate}>Updated {formatWhen(design.updatedAt)}</span>
                  </div>
                  <div className={styles.itemActions}>
                    <button type="button" className={styles.loadBtn} onClick={() => handleLoad(design)}>
                      Load
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Overwrite with the current design"
                      onClick={() => handleSaveToProject(design)}
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title="Export to .json file"
                      onClick={() => exportCalculationFile(design)}
                    >
                      <Download size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.danger}`}
                      title="Delete"
                      onClick={() => handleDelete(design)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
