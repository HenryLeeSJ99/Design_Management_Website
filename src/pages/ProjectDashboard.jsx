import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calculator,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FileUp,
  FolderInput,
  GripVertical,
  Layers,
  Link2,
  Loader2,
  Map,
  Paperclip,
  PenLine,
  Pencil,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  addDrawingItem,
  addPdfItem,
  applySnapshot,
  captureSession,
  coverHasContent,
  deleteCalculation,
  exportCalculationFile,
  exportProjectFile,
  getMarkups,
  getProject,
  importProjectFile,
  itemType,
  moveCalculation,
  parseCalculationFile,
  readJsonFile,
  renameItem,
  restoreSession,
  saveCalculation,
  setCoverPageEnabled,
  setCurrentDesign,
  setItemPdf,
  setProjectName,
  CALCULATORS,
} from '../services/projectStore';
import { deletePdf, generatePdfId, getPdf, putPdf } from '../services/pdfStore';
import { canUndo, onUndoChange, recordUndo, undo } from '../services/undo';
import styles from './ProjectDashboard.module.css';

// Both are dialogs, so neither they nor pdf.js load until actually opened
const CoverPageEditor = lazy(() => import('../components/CoverPageEditor'));
const CoverPreview = lazy(() => import('../components/CoverPreview'));
// Pulls in a whole calculator, so it only loads when a compile starts
const ReportAutoRenderer = lazy(() => import('../components/ReportAutoRenderer'));

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

/** One line on the dashboard row standing in for the whole cover form. */
const coverSummary = (cover) => {
  const bits = [cover.projectName, cover.reportReference, cover.revision].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Not filled in yet — open it to add your project details';
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
  const addDrawingRef = useRef(null);

  const [project, setProject] = useState(getProject);
  // Bumped whenever the store is re-read, so the cover dialog's local draft is
  // rebuilt after an action that can replace it wholesale (e.g. project import)
  const [coverEditorKey, setCoverEditorKey] = useState(0);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [coverPreviewOpen, setCoverPreviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [compiling, setCompiling] = useState(false);
  const [undoState, setUndoState] = useState({ label: null, depth: 0 });
  // The calculator currently mounted off-screen to have its report captured,
  // and the promise the compile loop is waiting on for it
  const [reportJob, setReportJob] = useState(null);
  const [progress, setProgress] = useState(null);
  const reportJobRef = useRef(null);

  // Drag state for reordering
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const refresh = () => {
    setProject(getProject());
    setCoverEditorKey((k) => k + 1);
  };
  const clearMessages = () => { setError(''); setNotice(''); setWarnings([]); };

  // Track the undo stack so the toolbar button can name what it will undo
  useEffect(() => onUndoChange((label, depth) => setUndoState({ label, depth })), []);

  // Ctrl/Cmd+Z, unless focus is in a field where the browser's own undo belongs
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        if (!canUndo()) return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // handleUndo closes over only stable setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = project.calculations;
  const calcs = items.filter((c) => itemType(c) === 'calculation');
  const pdfDocs = items.filter((c) => itemType(c) === 'pdf');
  const drawings = items.filter((c) => itemType(c) === 'drawing');

  // Which drawing markups point at each calculation, so a calculation row can
  // show where on the drawings it is referenced
  const linksByCalc = drawings.reduce((map, drawing) => {
    getMarkups(drawing).forEach((markup) => {
      if (!markup.calcId) return;
      map[markup.calcId] = [...(map[markup.calcId] || []), { markup, drawing }];
    });
    return map;
  }, {});
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

  const handleDelete = (item) => {
    const what = { pdf: 'document', drawing: 'drawing and its markups', calculation: 'calculation' }[itemType(item)];
    if (!window.confirm(`Remove ${what} "${item.name}" from the project?\n\nYou can undo this.`)) return;
    // Record before the change so undo restores it. The PDF's bytes are left in
    // the cache on purpose: undo can bring the item back, and the next save
    // sweeps the blob only if nothing ends up referencing it.
    recordUndo(`delete "${item.name}"`);
    deleteCalculation(item.id);
    refresh();
  };

  const handleRename = (item) => {
    const name = window.prompt('Name:', item.name);
    if (name != null && name.trim() && name.trim() !== item.name) {
      recordUndo(`rename "${item.name}"`);
      renameItem(item.id, name.trim());
      refresh();
    }
  };

  const handleMove = (from, to) => {
    recordUndo('reorder items');
    moveCalculation(from, to);
    refresh();
  };

  const handleUndo = () => {
    const label = undo();
    if (label) {
      refresh();
      setNotice(`Undone: ${label}.`);
    }
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

  const handleAddDrawing = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearMessages();
    try {
      const bytes = await readPdfFile(file);
      const pdfId = generatePdfId();
      await putPdf(pdfId, bytes);
      const id = addDrawingItem({
        name: file.name.replace(/\.pdf$/i, ''),
        pdfId,
        pdfName: file.name,
        pdfSize: bytes.byteLength,
      });
      refresh();
      navigate(`/drawing/${id}`);
    } catch (e) {
      setError(e.message || 'Failed to add the drawing.');
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
    if (!enabled) recordUndo('remove cover page');
    setCoverPageEnabled(enabled);
    refresh();
    if (!enabled && coverHasContent(getProject().cover)) {
      setNotice('Cover page left out of the compiled PDF. Your cover details are kept.');
    }
  };

  /**
   * Render one calculation's report off-screen and return its PDF bytes.
   * Bridges the imperative compile loop to the declarative renderer: mount the
   * job, and resolve when the harness reports the node is ready.
   */
  const renderReportFor = (calc) =>
    new Promise((resolve, reject) => {
      reportJobRef.current = { resolve, reject };
      setReportJob({ calculator: calc.calculator, token: `${calc.id}-${Date.now()}` });
    });

  const handleReportReady = async (node) => {
    const job = reportJobRef.current;
    if (!job) return;
    try {
      const { renderReportPdfBlob } = await import('../utils/reportPdf');
      const blob = await renderReportPdfBlob(node);
      job.resolve(await blob.arrayBuffer());
    } catch (e) {
      job.reject(e);
    }
  };

  const handleReportError = (e) => reportJobRef.current?.reject(e);

  /**
   * Regenerate every calculation's report from its saved snapshot, so the
   * compiled package always agrees with the stored numbers rather than with
   * whatever was attached by hand at some earlier point.
   */
  const regenerateReports = async (calculations) => {
    const notes = [];
    const savedSession = captureSession();
    try {
      for (let i = 0; i < calculations.length; i += 1) {
        const calc = calculations[i];
        setProgress({ index: i + 1, total: calculations.length, name: calc.name });
        try {
          // The calculator hydrates from sessionStorage, so the snapshot has
          // to be in place before the harness mounts it
          applySnapshot(calc.calculator, calc.data);
          const bytes = await renderReportFor(calc);
          if (calc.pdfId) await deletePdf(calc.pdfId).catch(() => {});
          const pdfId = generatePdfId();
          await putPdf(pdfId, bytes);
          setItemPdf(calc.id, { pdfId, pdfName: `${calc.name}.pdf`, pdfSize: bytes.byteLength });
        } catch (e) {
          // One bad report must not cost the whole package
          notes.push(calc.pdfId
            ? `"${calc.name}": could not regenerate its report (${e.message}) — the report attached earlier was used instead.`
            : `"${calc.name}": could not generate its report (${e.message}) — placeholder page inserted.`);
        } finally {
          setReportJob(null);
          reportJobRef.current = null;
        }
      }
    } finally {
      restoreSession(savedSession);
      setProgress(null);
    }
    return notes;
  };

  const handleCompile = async () => {
    clearMessages();
    setCompiling(true);
    try {
      const reportNotes = await regenerateReports(items.filter((c) => itemType(c) === 'calculation'));
      const { compileProjectPdf } = await import('../services/pdfCompile');
      const { bytes, warnings: compileWarnings } = await compileProjectPdf(getProject());
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^\w-]+/g, '-')}-compiled.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // A failed report already explains itself; drop pdfCompile's follow-on
      // "no report attached" note for the same item so it is not said twice
      setWarnings([...reportNotes, ...compileWarnings.filter((w) => !reportNotes.some((n) => n.startsWith(w.split(':')[0])))]);
      setNotice('Compiled PDF downloaded.');
      refresh();
    } catch (e) {
      setError(e.message || 'Failed to compile the PDF.');
    } finally {
      setCompiling(false);
      setProgress(null);
      setReportJob(null);
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
          {undoState.depth > 0 && (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleUndo}
              title={undoState.label ? `Undo ${undoState.label}` : 'Undo'}
            >
              <Undo2 size={15} /> Undo
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={() => addDrawingRef.current?.click()}>
            <Map size={15} /> Add Drawing
          </button>
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
            <FileText size={15} />
            {compiling
              ? (progress ? `Report ${progress.index} of ${progress.total}…` : 'Compiling…')
              : 'Compile PDF'}
          </button>
          <input ref={calcFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportCalcFile} />
          <input ref={projectFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportProjectFile} />
          <input ref={addPdfRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleAddPdf} />
          <input ref={addDrawingRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleAddDrawing} />
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
          <div className={styles.statHeader}><span>Drawings</span><Map size={17} /></div>
          <p className={styles.statValue}>{drawings.length}</p>
          <p className={styles.statLabel}>
            {drawings.reduce((n, d) => n + getMarkups(d).length, 0)} markup
            {drawings.reduce((n, d) => n + getMarkups(d).length, 0) === 1 ? '' : 's'} placed
          </p>
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
      {progress && (
        <div className={styles.progress}>
          <Loader2 size={14} className={styles.spin} />
          <span>
            Generating report {progress.index} of {progress.total} — <strong>{progress.name}</strong>
          </span>
        </div>
      )}
      {warnings.length > 0 && (
        <div className={styles.warningBox}>
          <strong>Compiled with notes:</strong>
          <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {/* Cover page — one compact row; the fields live in a dialog so the
          dashboard stays about the running order of the document */}
      {project.coverPage ? (
        <div className={`${styles.row} ${styles.coverRow}`}>
          <BookOpen size={16} className={styles.coverIcon} />
          <div className={styles.rowInfo}>
            <button
              type="button"
              className={styles.rowName}
              onClick={() => setCoverEditorOpen(true)}
              title="Edit the cover page details"
            >
              Cover Page
            </button>
            <div className={styles.rowMeta}>
              <span className={styles.badgeCover}>Included — page 1</span>
              <span className={styles.rowDate}>{coverSummary(project.cover)}</span>
            </div>
          </div>
          <div className={styles.rowActions}>
            <button type="button" className={styles.openBtn} onClick={() => setCoverEditorOpen(true)}>
              Edit
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setCoverPreviewOpen(true)}
              title="Preview the cover page"
            >
              <Eye size={14} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => handleToggleCover(false)}
              title="Leave the cover page out of the compiled PDF (your details are kept)"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.noCoverCard}>
          <div className={styles.noCoverInfo}>
            <BookOpen size={16} />
            <div>
              <p className={styles.noCoverTitle}>No cover page</p>
              <p className={styles.noCoverHint}>
                {coverHasContent(project.cover)
                  ? 'Your cover details are still saved — add it back and they return exactly as you left them.'
                  : 'The compiled PDF will start straight at your first item, with no title page or contents.'}
              </p>
            </div>
          </div>
          <button type="button" className={styles.btnSecondary} onClick={() => handleToggleCover(true)}>
            <BookOpen size={15} /> {coverHasContent(project.cover) ? 'Add cover page back' : 'Add Cover Page'}
          </button>
        </div>
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
            const type = itemType(item);
            const isPdf = type === 'pdf';
            const isDrawing = type === 'drawing';
            const isCalc = type === 'calculation';
            const markupCount = isDrawing ? getMarkups(item).length : 0;
            const links = isCalc ? linksByCalc[item.id] || [] : [];
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
                    <button
                      type="button"
                      className={styles.rowName}
                      onClick={() => (isDrawing ? navigate(`/drawing/${item.id}`) : handleOpen(item))}
                      title={isDrawing ? 'Open drawing markup' : 'Open in calculator'}
                    >
                      {item.name}
                    </button>
                  )}
                  <div className={styles.rowMeta}>
                    <span className={`${styles.badge} ${isPdf ? styles.badgePdf : ''} ${isDrawing ? styles.badgeDrawing : ''}`}>
                      {isPdf && 'PDF document'}
                      {isDrawing && 'Plan drawing'}
                      {isCalc && (CALCULATORS[item.calculator]?.title || item.calculator)}
                    </span>
                    {item.pdfId && (
                      <span className={styles.pdfChip} title={item.pdfName}>
                        <Paperclip size={11} /> {isCalc ? `Report · ${formatSize(item.pdfSize)}` : formatSize(item.pdfSize)}
                      </span>
                    )}
                    {isDrawing && (
                      <span className={styles.markupChip}>
                        <PenLine size={11} /> {markupCount} markup{markupCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {links.map(({ markup, drawing }) => (
                      <button
                        type="button"
                        key={markup.id}
                        className={styles.linkChip}
                        onClick={() => navigate(`/drawing/${drawing.id}`)}
                        title={`${markup.label || 'Markup'} on "${drawing.name}" — open the drawing`}
                      >
                        <Link2 size={11} /> {drawing.name} · p.{markup.page} · {markup.tag}
                      </button>
                    ))}
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

                  {isCalc && (
                    <button type="button" className={styles.openBtn} onClick={() => handleOpen(item)}>
                      Open
                    </button>
                  )}
                  {isDrawing && (
                    <button type="button" className={styles.openBtn} onClick={() => navigate(`/drawing/${item.id}`)}>
                      Markup
                    </button>
                  )}

                  {item.pdfId ? (
                    <button type="button" className={styles.iconBtn} onClick={() => handleDownloadItemPdf(item)} title="Download PDF">
                      <Download size={14} />
                    </button>
                  ) : (
                    isCalc && (
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

      {coverEditorOpen && (
        <Suspense fallback={null}>
          <CoverPageEditor
            key={coverEditorKey}
            cover={project.cover}
            onClose={() => { setCoverEditorOpen(false); refresh(); }}
          />
        </Suspense>
      )}

      {coverPreviewOpen && (
        <Suspense fallback={null}>
          <CoverPreview onClose={() => setCoverPreviewOpen(false)} />
        </Suspense>
      )}

      {/* Parked off-screen: renders each calculation's report during a compile */}
      {reportJob && (
        <Suspense fallback={null}>
          <ReportAutoRenderer job={reportJob} onReady={handleReportReady} onError={handleReportError} />
        </Suspense>
      )}
    </div>
  );
}
