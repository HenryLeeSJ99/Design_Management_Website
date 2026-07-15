/**
 * DrawingViewer.jsx
 * Renders a plan drawing PDF to a canvas and lets the engineer box regions of
 * it and link each box to a calculation in the project.
 *
 * Markup rectangles are stored in normalized page coordinates (0-1, origin
 * top-left), so they stay put across zoom levels, window sizes and devices.
 * Every edit writes through to the project store immediately — there is no
 * save button, and closing the tab cannot lose work.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Link2, Minus, Plus, Square, MousePointer2, Trash2,
} from 'lucide-react';
import {
  applySnapshot,
  getMarkups,
  getProject,
  itemType,
  listCalculations,
  setCurrentDesign,
  setItemMarkups,
  CALCULATORS,
} from '../services/projectStore';
import { getPdf } from '../services/pdfStore';
import styles from './DrawingViewer.module.css';

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
// Ignore stray clicks: a markup must cover at least this fraction of the page
const MIN_SIZE = 0.005;

const generateMarkupId = () =>
  `mk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** Turn a drag between two normalized points into a positive-sized rect. */
const rectFromPoints = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});

export default function DrawingViewer() {
  const { itemId } = useParams();
  const navigate = useNavigate();

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const overlayRef = useRef(null);
  const renderTaskRef = useRef(null);
  const dragStartRef = useRef(null);

  const [item] = useState(() =>
    getProject().calculations.find((c) => c.id === itemId && itemType(c) === 'drawing') || null,
  );
  const [calcs] = useState(() => listCalculations());

  const [pdf, setPdf] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [markups, setMarkups] = useState(() => getMarkups(item));
  const [mode, setMode] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState(item ? 'loading' : 'missing');
  const [error, setError] = useState('');

  const selected = markups.find((m) => m.id === selectedId) || null;
  const pageMarkups = markups.filter((m) => m.page === pageNum);

  /** Single write path for markups: state + localStorage together. */
  const commitMarkups = useCallback(
    (next) => {
      setMarkups(next);
      setItemMarkups(itemId, next);
    },
    [itemId],
  );

  const updateMarkup = (id, patch) =>
    commitMarkups(markups.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const deleteMarkup = (id) => {
    commitMarkups(markups.filter((m) => m.id !== id));
    setSelectedId(null);
  };

  // --- Load the PDF ---
  useEffect(() => {
    if (!item) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

        const bytes = await getPdf(item.pdfId);
        if (!bytes) throw new Error('The drawing file was not found on this device.');
        // pdf.js takes ownership of the buffer it is given, so hand it a copy —
        // otherwise the bytes in IndexedDB's returned buffer get detached
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
        if (cancelled) return;
        setPdf(doc);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Could not open this drawing.');
        setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [item]);

  // --- Fit to width once the document is open ---
  useEffect(() => {
    if (!pdf || !wrapRef.current) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(1);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const available = wrapRef.current.clientWidth - 40;
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, available / base.width)));
    })();
    return () => { cancelled = true; };
  }, [pdf]);

  // --- Render the current page ---
  useEffect(() => {
    if (!pdf) return undefined;
    let cancelled = false;

    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Back the canvas at device resolution so drawings stay legible when zoomed
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setPageSize({ width: viewport.width, height: viewport.height });

      const task = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        // pdf.js applies this before the viewport transform and reads its scale
        // back as outputScale, which it uses to pick image quality
        ...(dpr === 1 ? {} : { transform: [dpr, 0, 0, dpr, 0, 0] }),
      });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        /* superseded by a newer render — expected on zoom/page change */
      }
    })();

    return () => {
      cancelled = true;
      // Cleanup runs before the next render starts, so this only ever cancels
      // the render this effect began
      renderTaskRef.current?.cancel();
    };
  }, [pdf, pageNum, scale]);

  // --- Drawing new markups ---
  const pointAt = (event) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  };

  const onPointerDown = (event) => {
    if (mode !== 'draw' || event.button !== 0) return;
    event.preventDefault();
    overlayRef.current.setPointerCapture(event.pointerId);
    dragStartRef.current = pointAt(event);
    setDraft({ ...dragStartRef.current, w: 0, h: 0 });
  };

  const onPointerMove = (event) => {
    if (!dragStartRef.current) return;
    setDraft(rectFromPoints(dragStartRef.current, pointAt(event)));
  };

  const onPointerUp = (event) => {
    if (!dragStartRef.current) return;
    const rect = rectFromPoints(dragStartRef.current, pointAt(event));
    dragStartRef.current = null;
    setDraft(null);

    if (rect.w < MIN_SIZE || rect.h < MIN_SIZE) return;
    const markup = {
      id: generateMarkupId(),
      page: pageNum,
      rect,
      tag: String(markups.length + 1),
      label: '',
      calcId: null,
    };
    commitMarkups([...markups, markup]);
    setSelectedId(markup.id);
    setMode('select');
  };

  const handleOpenCalc = (calcId) => {
    const calc = calcs.find((c) => c.id === calcId);
    if (!calc) return;
    applySnapshot(calc.calculator, calc.data);
    setCurrentDesign(calc.calculator, { id: calc.id, name: calc.name });
    navigate(CALCULATORS[calc.calculator].route);
  };

  const calcName = (calcId) => calcs.find((c) => c.id === calcId)?.name || null;

  if (status === 'missing') {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.errorCard}>
          <p>This drawing is no longer in the project.</p>
          <button type="button" className={styles.btnSecondary} onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={15} /> Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button type="button" className={styles.iconBtn} onClick={() => navigate('/dashboard')} title="Back to dashboard">
            <ArrowLeft size={16} />
          </button>
          <div className={styles.titleBlock}>
            <h1>{item.name}</h1>
            <p>{markups.length} markup{markups.length === 1 ? '' : 's'} · saved automatically</p>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.modeGroup}>
            <button
              type="button"
              className={mode === 'select' ? styles.modeActive : styles.modeBtn}
              onClick={() => setMode('select')}
            >
              <MousePointer2 size={14} /> Select
            </button>
            <button
              type="button"
              className={mode === 'draw' ? styles.modeActive : styles.modeBtn}
              onClick={() => setMode('draw')}
            >
              <Square size={14} /> Add markup
            </button>
          </div>

          <div className={styles.zoomGroup}>
            <button type="button" className={styles.iconBtn} onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.25))} title="Zoom out">
              <Minus size={14} />
            </button>
            <span className={styles.zoomLabel}>{Math.round(scale * 100)}%</span>
            <button type="button" className={styles.iconBtn} onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.25))} title="Zoom in">
              <Plus size={14} />
            </button>
          </div>

          {pdf && pdf.numPages > 1 && (
            <div className={styles.pageGroup}>
              <button type="button" className={styles.iconBtn} disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)} title="Previous page">
                <ChevronLeft size={14} />
              </button>
              <span className={styles.zoomLabel}>{pageNum} / {pdf.numPages}</span>
              <button type="button" className={styles.iconBtn} disabled={pageNum >= pdf.numPages} onClick={() => setPageNum((p) => p + 1)} title="Next page">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {status === 'error' && <div className={styles.error}>{error}</div>}
      {mode === 'draw' && <div className={styles.hint}>Drag a box over the part of the drawing you want to link.</div>}

      <div className={styles.workspace}>
        <div className={styles.canvasWrap} ref={wrapRef}>
          {status === 'loading' && <p className={styles.loading}>Opening drawing…</p>}
          <div className={styles.canvasStage} style={{ width: pageSize.width || undefined }}>
            <canvas ref={canvasRef} className={styles.canvas} />
            <div
              ref={overlayRef}
              className={`${styles.overlay} ${mode === 'draw' ? styles.overlayDraw : ''}`}
              style={{ width: pageSize.width, height: pageSize.height }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {pageMarkups.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className={`${styles.markup} ${m.id === selectedId ? styles.markupSelected : ''} ${m.calcId ? styles.markupLinked : ''}`}
                  style={{
                    left: `${m.rect.x * 100}%`,
                    top: `${m.rect.y * 100}%`,
                    width: `${m.rect.w * 100}%`,
                    height: `${m.rect.h * 100}%`,
                  }}
                  onClick={() => { if (mode === 'select') setSelectedId(m.id); }}
                  title={m.label || calcName(m.calcId) || `Markup ${m.tag}`}
                >
                  <span className={styles.markupTag}>{m.tag}</span>
                </button>
              ))}
              {draft && (
                <div
                  className={styles.draftRect}
                  style={{
                    left: `${draft.x * 100}%`,
                    top: `${draft.y * 100}%`,
                    width: `${draft.w * 100}%`,
                    height: `${draft.h * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <aside className={styles.sidebar}>
          {selected ? (
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span>Markup {selected.tag}</span>
                <button type="button" className={`${styles.iconBtn} ${styles.danger}`} onClick={() => deleteMarkup(selected.id)} title="Delete markup">
                  <Trash2 size={14} />
                </button>
              </div>

              <label className={styles.field}>
                <span>Tag</span>
                <input
                  type="text" value={selected.tag}
                  onChange={(e) => updateMarkup(selected.id, { tag: e.target.value })}
                />
              </label>

              <label className={styles.field}>
                <span>Note</span>
                <textarea
                  rows={3} placeholder="What this region is"
                  value={selected.label}
                  onChange={(e) => updateMarkup(selected.id, { label: e.target.value })}
                />
              </label>

              <label className={styles.field}>
                <span>Linked calculation</span>
                <select
                  value={selected.calcId || ''}
                  onChange={(e) => updateMarkup(selected.id, { calcId: e.target.value || null })}
                >
                  <option value="">— Not linked —</option>
                  {calcs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              {selected.calcId && (
                <button type="button" className={styles.btnPrimary} onClick={() => handleOpenCalc(selected.calcId)}>
                  <ExternalLink size={14} /> Open calculation
                </button>
              )}
              {calcs.length === 0 && (
                <p className={styles.sidebarHint}>
                  No calculations in this project yet — save one from a calculator to link it here.
                </p>
              )}
            </div>
          ) : (
            <div className={styles.panel}>
              <div className={styles.panelHead}><span>Markups</span></div>
              {markups.length === 0 ? (
                <p className={styles.sidebarHint}>
                  Choose <strong>Add markup</strong>, then drag a box over the drawing to link a region
                  to a calculation.
                </p>
              ) : (
                <ul className={styles.markupList}>
                  {markups.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={styles.markupListBtn}
                        onClick={() => { setPageNum(m.page); setSelectedId(m.id); }}
                      >
                        <span className={styles.listTag}>{m.tag}</span>
                        <span className={styles.listBody}>
                          <span className={styles.listLabel}>{m.label || 'Untitled markup'}</span>
                          <span className={styles.listMeta}>
                            Page {m.page}
                            {m.calcId && <> · <Link2 size={10} /> {calcName(m.calcId) || 'missing'}</>}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
