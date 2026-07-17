/**
 * ReportAutoRenderer.jsx
 * Renders one calculation's report off-screen so a compile can capture it.
 *
 * A report only exists as DOM while its calculator is mounted on the Report
 * tab, and it is captured by rasterising that DOM. So to put a real report in
 * the compiled PDF we mount the actual calculator off-screen from the saved
 * snapshot and hand its report node back — which means the compiled report is
 * the same component the engineer sees on screen, not a second implementation
 * that could drift from it.
 *
 * The caller must apply the snapshot to sessionStorage *before* mounting this,
 * and is responsible for putting the engineer's own session back afterwards.
 */

import { lazy, Suspense, useEffect, useRef } from 'react';
import styles from './ReportAutoRenderer.module.css';

const CALCULATOR_COMPONENTS = {
  'multi-beam': lazy(() => import('../pages/MultiBeamCalculator')),
  'slab-formwork': lazy(() => import('../pages/SlabFormworkCalculator')),
  'wall-formwork': lazy(() => import('../pages/WallFormworkCalculator')),
  'wall-formwork-design': lazy(() => import('../pages/WallPanelDesignCalculator')),
  'shoring-tower': lazy(() => import('../pages/ShoringTowerCalculator')),
  'steel-prop': lazy(() => import('../pages/SteelPropCalculator')),
};

const READY_TIMEOUT = 40000;
const POLL_MS = 150;
// Charts animate and webfonts swap in after first paint; capturing too early
// yields a half-drawn sheet, so let it settle once it appears.
const SETTLE_MS = 1200;

/** Resolve with the report node once it is mounted, laid out and settled. */
function waitForReport(hostRef) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const node = hostRef.current?.querySelector('[data-report-root]');
      const laidOut = node && node.getBoundingClientRect().height > 50;
      if (laidOut) {
        const fonts = document.fonts?.ready ?? Promise.resolve();
        fonts.then(() => setTimeout(() => resolve(node), SETTLE_MS));
        return;
      }
      if (Date.now() - startedAt > READY_TIMEOUT) {
        reject(new Error('its report did not finish rendering in time'));
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
  });
}

/**
 * @param job      {calculator, token} — null renders nothing. Remount per job
 *                 via token so the calculator re-reads sessionStorage.
 * @param onReady  called with the report DOM node, ready to capture
 * @param onError  called if the report never appears
 */
export default function ReportAutoRenderer({ job, onReady, onError }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!job) return undefined;
    let cancelled = false;
    waitForReport(hostRef)
      .then((node) => { if (!cancelled) onReady(node); })
      .catch((e) => { if (!cancelled) onError(e); });
    return () => { cancelled = true; };
    // onReady/onError are held in refs by the caller, so only the job matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.token]);

  if (!job) return null;
  const Calculator = CALCULATOR_COMPONENTS[job.calculator];
  if (!Calculator) return null;

  return (
    <div ref={hostRef} className={styles.host} aria-hidden="true">
      <Suspense fallback={null}>
        <Calculator key={job.token} initialTab="report" />
      </Suspense>
    </div>
  );
}
