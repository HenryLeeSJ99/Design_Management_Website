/**
 * CoverPageEditor.jsx
 * The typed content of the printed title page, as a dialog. It lives in a
 * modal rather than on the dashboard because the dashboard's job is showing
 * the running order of calculations and drawings — twenty title-page fields
 * sitting open would bury that.
 *
 * Every edit writes straight through to the project store, so input is saved
 * as it is typed and closing the dialog can never lose anything. Local state
 * mirrors the store only so typing stays responsive.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { BookOpen, Check, Eye, Plus, Trash2, X } from 'lucide-react';
import { newRevisionRow, setCover } from '../services/projectStore';
import styles from './CoverPageEditor.module.css';

// pdf.js + pdf-lib only load if the engineer actually opens the preview
const CoverPreview = lazy(() => import('./CoverPreview'));

const nextRevisionNo = (revisions) => String(revisions.length).padStart(2, '0');

export default function CoverPageEditor({ cover, onClose }) {
  const [draft, setDraft] = useState(cover);
  const [savedAt, setSavedAt] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Escape closes the dialog — safe, because every keystroke is already saved.
  // Not while the preview is up: there, Escape belongs to the preview.
  useEffect(() => {
    if (previewOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, previewOpen]);

  // Write through to localStorage on every change
  const commit = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setCover(patch);
    setSavedAt(Date.now());
  };

  const field = (key) => ({
    value: draft[key] ?? '',
    onChange: (e) => commit({ [key]: e.target.value }),
  });

  const commitRevisions = (revisions) => commit({ revisions });

  const updateRevision = (index, key, value) =>
    commitRevisions(draft.revisions.map((r, i) => (i === index ? { ...r, [key]: value } : r)));

  const addRevision = () =>
    commitRevisions([...draft.revisions, newRevisionRow(nextRevisionNo(draft.revisions))]);

  const removeRevision = (index) =>
    commitRevisions(draft.revisions.filter((_, i) => i !== index));

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <section
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cover page details"
      >
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <BookOpen size={16} />
            <span>Cover Page</span>
            <span className={styles.badgeOn}>Included — page 1</span>
          </div>
          <div className={styles.headerRight}>
            {savedAt > 0 && (
              <span className={styles.savedFlag} key={savedAt}>
                <Check size={12} /> Saved
              </span>
            )}
            <button type="button" className={styles.previewBtn} onClick={() => setPreviewOpen(true)}>
              <Eye size={14} /> Preview
            </button>
            <button type="button" className={styles.doneBtn} onClick={onClose}>
              Done
            </button>
            <button type="button" className={styles.iconBtn} onClick={onClose} title="Close">
              <X size={15} />
            </button>
          </div>
        </header>

        <div className={styles.scroll}>
          <div className={styles.grid}>
            <label className={styles.fieldSm}>
              <span>Template version</span>
              <input type="text" placeholder="V3.2" {...field('templateVersion')} />
            </label>
            <label className={styles.fieldSm}>
              <span>PLYTEC project ref.</span>
              <input type="text" placeholder="P26023" {...field('companyRef')} />
            </label>
            <label className={styles.fieldSm}>
              <span>Issue date</span>
              <input type="text" placeholder="June 2026" {...field('issueDate')} />
            </label>

            <label className={styles.fieldWide}>
              <span>Calculation title</span>
              <input type="text" placeholder="WCL48 Shoring Design Calculation" {...field('title')} />
            </label>
            <label className={styles.fieldSm}>
              <span>Subtitle</span>
              <input type="text" placeholder="for Level 2" {...field('subtitle')} />
            </label>

            <label className={styles.fieldWide}>
              <span>Project name</span>
              <input type="text" placeholder="KYLIEZ" {...field('projectName')} />
            </label>
            <label className={styles.fieldSm}>
              <span>Project reference</span>
              <input type="text" placeholder="P26023" {...field('projectReference')} />
            </label>

            <label className={styles.fieldWide}>
              <span>Report reference</span>
              <input type="text" placeholder="P26023_KYLIEZ_DRPT_01" {...field('reportReference')} />
            </label>
            <label className={styles.fieldSm}>
              <span>Revision</span>
              <input type="text" placeholder="rev01" {...field('revision')} />
            </label>

            <label className={styles.fieldFull}>
              <span>Project title</span>
              <textarea
                rows={7}
                placeholder={'CADANGAN PEMBANGUNAN 1 BLOCK PERDAGANGAN BERCAMPUR 37 TINGKAT MENGANDUNGI:\ni. 1 TINGKAT RUANG LOBI DAN RUANG M&E DI ARAS BAWAH.\n…'}
                {...field('projectTitle')}
              />
              <small>Printed as typed — line breaks are preserved on the cover.</small>
            </label>

            <label className={styles.fieldFull}>
              <span>PE endorsement</span>
              <input type="text" placeholder="Left blank for the endorsement stamp" {...field('peEndorsement')} />
            </label>
          </div>

          <div className={styles.revisions}>
            <div className={styles.revisionsHead}>
              <span>Revisions</span>
              <button type="button" className={styles.addBtn} onClick={addRevision}>
                <Plus size={13} /> Add revision
              </button>
            </div>

            {draft.revisions.length === 0 ? (
              <p className={styles.revisionsEmpty}>
                No revisions yet — add one to fill the preparer / checker table on the cover.
              </p>
            ) : (
              <div className={styles.revisionTable}>
                <div className={`${styles.revisionRow} ${styles.revisionHeader}`}>
                  <span>Revision</span>
                  <span>Preparer</span>
                  <span>Date</span>
                  <span>Checker</span>
                  <span>Date</span>
                  <span />
                </div>
                {draft.revisions.map((rev, index) => (
                  <div className={styles.revisionRow} key={index}>
                    <input
                      type="text" placeholder="00" value={rev.no ?? ''}
                      onChange={(e) => updateRevision(index, 'no', e.target.value)}
                    />
                    <input
                      type="text" placeholder="YMN" value={rev.preparer ?? ''}
                      onChange={(e) => updateRevision(index, 'preparer', e.target.value)}
                    />
                    <input
                      type="text" placeholder="6/3/26" value={rev.preparerDate ?? ''}
                      onChange={(e) => updateRevision(index, 'preparerDate', e.target.value)}
                    />
                    <input
                      type="text" placeholder="YAP" value={rev.checker ?? ''}
                      onChange={(e) => updateRevision(index, 'checker', e.target.value)}
                    />
                    <input
                      type="text" placeholder="6/3/26" value={rev.checkerDate ?? ''}
                      onChange={(e) => updateRevision(index, 'checkerDate', e.target.value)}
                    />
                    <button
                      type="button" className={`${styles.iconBtn} ${styles.danger}`}
                      onClick={() => removeRevision(index)} title="Remove revision"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {previewOpen && (
          <Suspense fallback={null}>
            <CoverPreview onClose={() => setPreviewOpen(false)} />
          </Suspense>
        )}
      </section>
    </div>
  );
}
