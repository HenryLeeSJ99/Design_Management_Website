/**
 * @module utils/reportPdf
 * @description iOS-safe report export.
 *
 * `window.open()` + `print()` crashes iOS Safari (and iOS PWAs), so on
 * Apple touch devices the report DOM is rendered to a real PDF
 * (html2canvas → jsPDF) and handed to the native share sheet instead.
 * Desktop / Android keep the regular print window flow.
 */

/** True on iPhone/iPod/iPad — including iPadOS 13+, which masquerades
 *  as desktop Safari but exposes multi-touch on a "MacIntel" platform. */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iDevice || iPadOS;
}

const A4_W = 210;
const A4_H = 297;

/**
 * Renders a report node to an A4 jsPDF document. Multi-page reports are
 * split on their `.report-page` children; a node without any becomes a
 * single page.
 *
 * @param {HTMLElement} node The report container (e.g. reportRef.current)
 * @returns {Promise<object>} the jsPDF instance
 */
async function renderReportPdf(node) {
  // Loaded on demand so the PDF machinery stays out of the initial chunks
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const pages = node.querySelectorAll('.report-page').length
    ? [...node.querySelectorAll('.report-page')]
    : [node];

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      // The on-screen sheet is shrunk with CSS zoom on small viewports —
      // capture the clone at full size so the PDF stays crisp.
      onclone: (doc) => {
        doc.querySelectorAll('[class*="reportSheet"]').forEach((el) => {
          el.style.zoom = 1;
        });
      },
    });

    if (i > 0) pdf.addPage();
    // Fit to the A4 page, preserving aspect ratio (content that runs
    // longer than A4 is scaled down rather than clipped).
    const ratio = canvas.height / canvas.width;
    let drawW = A4_W;
    let drawH = A4_W * ratio;
    if (drawH > A4_H) {
      drawH = A4_H;
      drawW = A4_H / ratio;
    }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (A4_W - drawW) / 2, 0, drawW, drawH);
  }

  return pdf;
}

/**
 * Renders a report node to a PDF Blob — used to attach calculation reports
 * to the project for dashboard compilation.
 */
export async function renderReportPdfBlob(node) {
  const pdf = await renderReportPdf(node);
  return pdf.output('blob');
}

/**
 * Renders a report node to an A4 PDF and opens the iOS share sheet.
 * Falls back to a plain PDF download when the Web Share API can't take
 * files.
 *
 * @param {HTMLElement} node     The report container (e.g. reportRef.current)
 * @param {string}      fileName e.g. 'TempWorks-Shoring-Tower-Report.pdf'
 */
export async function shareReportPdf(node, fileName) {
  const pdf = await renderReportPdf(node);
  const blob = pdf.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName.replace(/\.pdf$/i, '') });
      return;
    } catch (err) {
      // User dismissed the sheet — not an error
      if (err && err.name === 'AbortError') return;
      // NotAllowedError etc. → fall through to a plain download
    }
  }

  pdf.save(fileName);
}
