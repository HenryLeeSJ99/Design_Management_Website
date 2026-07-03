/**
 * @module report
 * @description Generates a single-page PDF report for formwork beam design
 * calculations using jsPDF and jspdf-autotable, matching a compact layout.
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';

/* ──────────────────────── constants ──────────────────────── */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = { top: 15, bottom: 15, left: 15, right: 15 };
const CONTENT_W = PAGE_W - MARGIN.left - MARGIN.right;

const C = {
  headerText: '#111827',
  subHeaderText: '#6B7280',
  tableHeaderBg: '#F3F4F6',
  tableHeaderText: '#111827',
  rowEven: '#FFFFFF',
  rowOdd: '#F9FAFB',
  pass: '#059669',
  fail: '#DC2626',
  textPrimary: '#374151',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  accent: '#2563EB', 
  redAccent: '#DC2626', 
};

/* ──────────────────────── public API ──────────────────────── */

export function generateReport(projectInfo, inputData, solverResults, designChecks, canvasElements) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  drawHeader(doc, projectInfo);

  // Columns layout
  const col1X = MARGIN.left;
  const col1W = 100;
  const col2X = col1X + col1W + 5;
  const col2W = 75;
  
  let currentY = 32; 

  // Left Column
  currentY = drawBoundaryConditions(doc, inputData, col1X, currentY, col1W);
  currentY += 5;
  currentY = drawResults(doc, solverResults, col1X, currentY, col1W);
  currentY += 5;
  currentY = drawDesignChecks(doc, inputData, designChecks, solverResults, col1X, currentY, col1W);
  currentY += 5;
  drawVerdict(doc, designChecks, col1X, currentY, col1W);

  // Right Column
  drawDiagrams(doc, canvasElements, col2X, 32, col2W);

  // Footer
  drawFooter(doc, projectInfo);

  // Open in new tab
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

/* ──────────────────────── Layout Components ──────────────────────── */

function drawHeader(doc, info) {
  doc.setTextColor(C.headerText);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Formwork Beam Calculator | Results', MARGIN.left, MARGIN.top + 5);

  doc.setTextColor(C.subHeaderText);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('based on BS EN 1993-1-1', MARGIN.left, MARGIN.top + 11);

  // Simple Logo placeholder on the right
  const logoX = PAGE_W - MARGIN.right - 25;
  const logoY = MARGIN.top - 2;
  doc.setFillColor(C.accent);
  doc.rect(logoX, logoY, 25, 12, 'F');
  doc.setFillColor(C.redAccent);
  doc.rect(logoX + 2, logoY + 2, 21, 8, 'F');
  doc.setTextColor('#FFFFFF');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('APP', logoX + 12.5, logoY + 7.5, { align: 'center' });
}

function drawBoundaryConditions(doc, data, x, y, width) {
  const spanStr = data.spans.map((s, i) => `L${i + 1}: ${s} mm`).join(', ');

  const body = [
    ['Configuration', data.configuration || '—'],
    ['Spans', spanStr],
    ['Applied Loads', data.loadsStr || '—'],
    ['Section Type', data.isSystemBeam ? 'System Beam' : 'Standard Section'],
    ['Section', data.sectionName || '—'],
    ['Steel Grade', data.gradeName || '—'],
    ['Deflection Limit', data.deflectionLimit || '—'],
  ];

  if (data.isSystemBeam && data.systemCapacities) {
    body.push(['Moment Cap.', `${data.systemCapacities.momentCapacity ?? '—'} kNm`]);
    body.push(['Shear Cap.', `${data.systemCapacities.shearCapacity ?? '—'} kN`]);
  }

  doc.autoTable({
    startY: y,
    margin: { left: x },
    tableWidth: width,
    head: [['Boundary Conditions', '']],
    body,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2, textColor: C.textPrimary },
    headStyles: { fillColor: C.tableHeaderBg, textColor: C.tableHeaderText, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: width - 40, halign: 'right' },
    },
    alternateRowStyles: { fillColor: C.rowEven },
    didDrawCell: (data) => {
      // Add thin bottom border to rows like PERI
      if (data.row.index > -1) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  return doc.lastAutoTable.finalY;
}

function drawResults(doc, results, x, y, width) {
  const body = [];
  
  if (results.maxMoment) body.push(['Max Moment', `${fmt(results.maxMoment.value)} kNm`]);
  if (results.maxShear) body.push(['Max Shear', `${fmt(results.maxShear.value)} kN`]);
  if (results.maxDeflection) body.push(['Max Deflection', `${fmt(results.maxDeflection.value, 2)} mm`]);

  doc.autoTable({
    startY: y,
    margin: { left: x },
    tableWidth: width,
    head: [['Results', '']],
    body,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2, textColor: C.textPrimary },
    headStyles: { fillColor: C.tableHeaderBg, textColor: C.tableHeaderText, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: width - 50, halign: 'right', fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.row.index > -1) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  return doc.lastAutoTable.finalY;
}

function drawDesignChecks(doc, inputData, checks, results, x, y, width) {
  const body = [];
  const isSystem = inputData.isSystemBeam;
  
  if (!isSystem && checks.classification) {
    body.push(['Section Class', `Class ${checks.classification.sectionClass}`]);
  }
  
  let bendRatio = isSystem ? checks.systemBeam.bendingCheck.ratio : (checks.bending ? checks.bending.ratio : 0);
  let shearRatio = isSystem ? checks.systemBeam.shearCheck.ratio : (checks.shear ? checks.shear.ratio : 0);
  let deflRatio = checks.deflection ? checks.deflection.ratio : 0;
  
  body.push(['Bending Utilisation', `${(bendRatio * 100).toFixed(1)}%`]);
  body.push(['Shear Utilisation', `${(shearRatio * 100).toFixed(1)}%`]);
  body.push(['Deflection Utilisation', `${(deflRatio * 100).toFixed(1)}%`]);

  doc.autoTable({
    startY: y,
    margin: { left: x },
    tableWidth: width,
    head: [['Design Checks (BS EN 1993-1-1)', '']],
    body,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 2, textColor: C.textPrimary },
    headStyles: { fillColor: C.tableHeaderBg, textColor: C.tableHeaderText, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: width - 60, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.row.index > -1) {
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  return doc.lastAutoTable.finalY;
}

function drawVerdict(doc, checks, x, y, width) {
  doc.setFillColor(checks.overallPass ? '#E8F5E9' : '#FFEBEE');
  doc.rect(x, y, width, 10, 'F');
  
  doc.setTextColor(checks.overallPass ? C.pass : C.fail);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const text = checks.overallPass ? 'VERDICT: PASS' : 'VERDICT: FAIL';
  doc.text(text, x + width / 2, y + 6.5, { align: 'center' });
}

function drawDiagrams(doc, canvases, x, y, width) {
  // Draw header for diagrams
  doc.setFillColor(C.tableHeaderBg);
  doc.rect(x, y, width, 6, 'F');
  doc.setTextColor(C.tableHeaderText);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Structural Diagrams', x + 2, y + 4.5);

  let currentY = y + 8;
  const labels = ['Beam Layout', 'Shear Force (SFD)', 'Bending Moment (BMD)', 'Deflection'];
  const elements = [canvases.beamDiagram, canvases.sfd, canvases.bmd, canvases.deflection];

  elements.forEach((canvas, i) => {
    if (!canvas) return;
    
    // Label
    doc.setTextColor(C.subHeaderText);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(labels[i], x, currentY + 3);
    currentY += 4;
    
    // Image
    const imgData = canvas.toDataURL('image/png');
    const imgH = width * (canvas.height / canvas.width);
    doc.addImage(imgData, 'PNG', x, currentY, width, imgH);
    
    currentY += imgH + 5;
  });
}

function drawFooter(doc, info) {
  const footerY = PAGE_H - MARGIN.bottom;

  // Disclaimer line
  doc.setTextColor(C.textPrimary);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Please pay attention:', MARGIN.left, footerY - 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(C.subHeaderText);
  doc.text(
    'The illustrations and calculations are understood to be system representations only.\n' +
    'The assembly instructions provide a basis for the project related risk assessment. They do not replace it.\n' +
    'This application is based on BS EN 1993-1-1 and related structural codes.',
    MARGIN.left, footerY - 11, { maxWidth: CONTENT_W }
  );

  // Line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN.left, footerY, PAGE_W - MARGIN.right, footerY);

  // Bottom info
  doc.setFontSize(7);
  doc.text(`${info.date || new Date().toLocaleDateString()} | Formwork Beam Calculator | ${info.projectName || '—'}`, MARGIN.left, footerY + 5);
  doc.text('Page 1 | 1', PAGE_W - MARGIN.right, footerY + 5, { align: 'right' });
}

/* ──────────────────────── Utils ──────────────────────── */

function fmt(num, dec = 2) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return Number(num).toFixed(dec);
}

function sanitiseFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}
