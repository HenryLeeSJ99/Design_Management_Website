import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calculator,
  Clock,
  Download,
  FileCheck2,
  FileText,
  FileUp,
  FolderInput,
  GripVertical,
  Layers,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  addPdfItem,
  applySnapshot,
  deleteCalculation,
  exportCalculationFile,
  exportProjectFile,
  getProject,
  importProjectFile,
  itemType,
  moveCalculation,
  parseCalculationFile,
  readJsonFile,
  renameItem,
  saveCalculation,
  setCoverPageEnabled,
  setCurrentDesign,
  setProjectName,
  CALCULATORS,
} from '../services/projectStore';
import { deletePdf, generatePdfId, getPdf, putPdf } from '../services/pdfStore';
import styles from './ProjectDashboard.module.css';

const formatWhen = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

async function readPdfFile(file) {
  const bytes = await file.arrayBuffer();
  const head = new TextDecoder().decode(new Uint8Array(bytes.slice(0, 5)));
  if (!head.startsWith('%PDF')) throw new Error(`"${file.name}" is not a PDF file.`);
  return bytes;
}

export default function ProjectDashboard() {
  const navigate = useNavigate();
  const calcFileRef = useRef(null);
  const projectFileRef = useRef(null);
  const addPdfRef = useRef(null);

  const [project, setProject] = useState(getProject);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [compiling, setCompiling] = useState(false);

  // Drag state for reordering
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const refresh = () => setProject(getProject());
  const clearMessages = () => { setError(''); setNotice(''); setWarnings([]); };

  const items = project.calculations;
  const calcs = items.filter((c) => itemType(c) === 'calculation');
  const pdfDocs = items.filter((c) => itemType(c) === 'pdf');
  const attachedCount = calcs.filter((c) => c.pdfId).length;
  const lastUpdated = items.reduce((max, c) => Math.max(max, c.updatedAt || 0), 0);

  const handleRenameProject = () => {
    const name = window.prompt('Project name:', project.name);
    if (name != null && name.trim()) {
      setProjectName(name.trim());
      refresh();
    }
  };

  const handleOpen = (calc) => {
    applySnapshot(calc.calculator, calc.data);
    // Link the calculator session to this project item so its Report tab
    // attaches the PDF to the right calculation
    setCurrentDesign(calc.calculator, { id: calc.id, name: calc.name });
    navigate(CALCULATORS[calc.calculator].route);
  };

  const handleDelete = async (item) => {
    const what = itemType(item) === 'pdf' ? 'document' : 'calculation';
    if (!window.confirm(`Delete ${what} "${item.name}" from the project? This cannot be undone.`)) return;
    deleteCalculation(item.id);
    if (item.pdfId) await deletePdf(item.pdfId).catch(() => {});
    refresh();
  };

  const handleRename = (item) => {
    const name = window.prompt('Name:', item.name);
    if (name != null && name.trim()) {
      renameItem(item.id, name.trim());
      refresh();
    }
  };

  const handleMove = (from, to) => {
    moveCalculation(from, to);
    refresh();
  };

  // --- File imports ---

  const handleImportCalcFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearMessages();
    try {
      const parsed = parseCalculationFile(await readJsonFile(file));
      saveCalculation(parsed);
      refresh();
      setNotice(`"${parsed.name}" added to the project.`);
    } catch (e) {
      setError(e.message || 'Failed to import the calculation file.');
    }
  };

  const handleImportProjectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearMessages();
    try {
      const obj = await readJsonFile(file);
      if (
        items.length > 0 &&
        !window.confirm('Importing a project replaces the current project and all its calculations. Continue?')
      ) return;
      // Free stored PDF bytes belonging to the project being replaced
      await Promise.all(items.filter((c) => c.pdfId).map((c) => deletePdf(c.pdfId).catch(() => {})));
      const count = importProjectFile(obj);
      refresh();
      setNotice(`Project imported (${count} calculation${count === 1 ? '' : 's'}).`);
    } catch (e) {
      setError(e.message || 'Failed to import the project file.');
    }
  };

  // --- PDF documents ---

  const handleAddPdf = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearMessages();
    try {
      const bytes = await readPdfFile(file);
      const pdfId = generatePdfId();
      await putPdf(pdfId, bytes);
      addPdfItem({
        name: file.name.replace(/\.pdf$/i, ''),
        pdfId,
        pdfName: file.name,
        pdfSize: bytes.byteLength,
      });
      refresh();
      setNotice(`"${file.name}" added to the project.`);
    } catch (e) {
      setError(e.message || 'Failed to add the PDF.');
    }
  };

  const handleDownloadItemPdf = async (item) => {
    clearMessages();
    const bytes = item.pdfId ? await getPdf(item.pdfId) : null;
    if (!bytes) {
      setError(`The PDF for "${item.name}" was not found on this device.`);
      return;
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.pdfName || `${item.name}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Compile ---

  const handleToggleCover = (enabled) => {
    clearMessages();
    setCoverPageEnabled(enabled);
    refresh();
  };

  const handleCompile = async () => {
    clearMessages();
    setCompiling(true);
    try {
      const { compileProjectPdf } = await import('../services/pdfCompile');
      const { bytes, warnings: compileWarnings } = await compileProjectPdf(getProject());
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^\w-]+/g, '-')}-compiled.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setWarnings(compileWarnings);
      setNotice('Compiled PDF downloaded.');
    } catch (e) {
      setError(e.message || 'Failed to compile the PDF.');
    } finally {
      setCompiling(false);
    }
  };

  // --- Drag & drop reorder ---
  const onDragStart = (index) => (e) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox needs data set for a drag to start
    e.dataTransfer.setData('text/plain', String(index));
  };
  const onDragOver = (index) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== overIndex) setOverIndex(index);
  };
  const onDrop = (index) => (e) => {
    e.preventDefault();
    if (dragIndex != null && dragIndex !== index) handleMove(dragIndex, index);
    setDragIndex(null);
    setOverIndex(null);
  };
  const onDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <div className={styles.projectNameRow}>
            <h1>{project.name}</h1>
            <button type="button" className={styles.iconBtn} onClick={handleRenameProject} title="Rename project">
              <Pencil size={15} />
            </button>
          </div>
          <p>
            {items.length === 0
              ? 'Project dashboard — saved calculations will appear here'
              : 'Drag rows to arrange the compiled document order'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => addPdfRef.current?.click()}>
            <FileUp size={15} /> Add Your PDF
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => calcFileRef.current?.click()}>
            <FolderInput size={15} /> Import calculation
          </button>
          <button type="button" className={styles.btnSecondary} onClick={() => projectFileRef.current?.click()}>
            <FolderInput size={15} /> Import project
          </button>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => { clearMessages(); exportProjectFile(); }}
            disabled={items.length === 0}
          >
            <Download size={15} /> Export project
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleCompile}
            disabled={compiling || items.length === 0}
          >
            <FileText size={15} /> {compiling ? 'Compiling…' : 'Compile PDF'}
          </button>
          <input ref={calcFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportCalcFile} />
          <input ref={projectFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportProjectFile} />
          <input ref={addPdfRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleAddPdf} />
        </div>
      </header>

      {/* Basic stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}><span>Calculations</span><Calculator size={17} /></div>
          <p className={styles.statValue}>{calcs.length}</p>
          <p className={styles.statLabel}>
            {[...new Set(calcs.map((c) => c.calculator))].length || 'No'} calculator type{[...new Set(calcs.map((c) => c.calculator))].length === 1 ? '' : 's'} used
          </p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}><span>Reports attached</span><FileCheck2 size={17} /></div>
          <p className={styles.statValue}>{attachedCount}<span className={styles.statOf}> / {calcs.length}</span></p>
          <p className={styles.statLabel}>calculation report PDFs</p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}><span>Documents</span><Layers size={17} /></div>
          <p className={styles.statValue}>{pdfDocs.length}</p>
          <p className={styles.statLabel}>additional PDFs added</p>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}><span>Last updated</span><Clock size={17} /></div>
          <p className={styles.statValueSmall}>{lastUpdated ? formatWhen(lastUpdated) : '—'}</p>
          <p className={styles.statLabel}>most recent change</p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}
      {warnings.length > 0 && (
        <div className={styles.warningBox}>
          <strong>Compiled with notes:</strong>
          <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {/* Cover page row */}
      {project.coverPage ? (
        <div className={`${styles.row} ${styles.coverRow}`}>
          <BookOpen size={16} className={styles.coverIcon} />
          <div className={styles.rowInfo}>
            <span className={styles.rowNameStatic}>Cover Page</span>
            <div className={styles.rowMeta}>
              <span className={styles.badge}>Auto-generated</span>
              <span className={styles.rowDate}>Project title, stats & table of contents — always first</span>
            </div>
          </div>
          <div className={styles.rowActions}>
            <button type="button" className={styles.iconBtn} onClick={() => handleToggleCover(false)} title="Remove cover page">
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.addCoverBtn} onClick={() => handleToggleCover(true)}>
          <BookOpen size={15} /> Add Cover Page
        </button>
      )}

      {items.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No calculations in this project yet</p>
          <p className={styles.emptyHint}>
            Open a calculator and use its <strong>Designs</strong> button to save a calculation to the
            project, add a .pdf with <strong>Add Your PDF</strong>, or import a .json calculation file.
          </p>
        </div>
      ) : (
        <div className={styles.listCard}>
          {items.map((item, index) => {
            const isPdf = itemType(item) === 'pdf';
            return (
              <div
                key={item.id}
                className={[
                  styles.row,
                  dragIndex === index ? styles.dragging : '',
                  overIndex === index && dragIndex !== null && dragIndex !== index ? styles.dropTarget : '',
                ].join(' ')}
                draggable
                onDragStart={onDragStart(index)}
                onDragOver={onDragOver(index)}
                onDrop={onDrop(index)}
                onDragEnd={onDragEnd}
              >
                <span className={styles.dragHandle} title="Drag to reorder">
                  <GripVertical size={16} />
                </span>
                <span className={styles.orderNo}>{index + 1}</span>

                <div className={styles.rowInfo}>
                  {isPdf ? (
                    <span className={styles.rowNameStatic}>{item.name}</span>
                  ) : (
                    <button type="button" className={styles.rowName} onClick={() => handleOpen(item)} title="Open in calculator">
                      {item.name}
                    </button>
                  )}
                  <div className={styles.rowMeta}>
                    <span className={`${styles.badge} ${isPdf ? styles.badgePdf : ''}`}>
                      {isPdf ? 'PDF document' : CALCULATORS[item.calculator]?.title || item.calculator}
                    </span>
                    {item.pdfId && (
                      <span className={styles.pdfChip} title={item.pdfName}>
                        <Paperclip size={11} /> {isPdf ? formatSize(item.pdfSize) : `Report · ${formatSize(item.pdfSize)}`}
                      </span>
                    )}
                    <span className={styles.rowDate}>Updated {formatWhen(item.updatedAt)}</span>
                  </div>
                </div>

                <div className={styles.rowActions}>
                  <span className={styles.moveBtns}>
                    <button type="button" className={styles.iconBtn} disabled={index === 0} onClick={() => handleMove(index, index - 1)} title="Move up">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" className={styles.iconBtn} disabled={index === items.length - 1} onClick={() => handleMove(index, index + 1)} title="Move down">
                      <ArrowDown size={14} />
                    </button>
                  </span>

                  {!isPdf && (
                    <button type="button" className={styles.openBtn} onClick={() => handleOpen(item)}>
                      Open
                    </button>
                  )}

                  {item.pdfId ? (
                    <button type="button" className={styles.iconBtn} onClick={() => handleDownloadItemPdf(item)} title="Download PDF">
                      <Download size={14} />
                    </button>
                  ) : (
                    !isPdf && (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => { clearMessages(); exportCalculationFile(item); }}
                        title="Export design to .json file"
                      >
                        <Download size={14} />
                      </button>
                    )
                  )}

                  <button type="button" className={styles.iconBtn} onClick={() => handleRename(item)} title="Rename">
                    <Pencil size={14} />
                  </button>
                  <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => handleDelete(item)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
