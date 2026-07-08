import jsPDF from 'jspdf';
import 'jspdf-autotable';
import styles from './MultiSpanBeam.module.css';
import { ResultCharts } from '@engine/graphics';

export default function ResultsView({ results, sectionName }) {
  const { analysis, checks, maxM, maxV, maxDefl } = results;

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('TempWorks Design Management System', 14, 22);
    
    doc.setFontSize(14);
    doc.text('Multi-Span Beam Calculation Report', 14, 32);
    
    doc.setFontSize(10);
    doc.text(`Section: ${sectionName}`, 14, 45);
    doc.text(`Overall Status: ${checks.overall.status}`, 14, 52);

    doc.autoTable({
      startY: 60,
      head: [['Check', 'Max Value', 'Allowable', 'Utilization', 'Status']],
      body: [
        ['Bending Moment', `${maxM.toFixed(2)} kNm`, `${checks.bending.Mc_Rd?.toFixed(2)} kNm`, `${(checks.bending.ratio * 100).toFixed(1)}%`, checks.bending.ratio <= 1 ? 'PASS' : 'FAIL'],
        ['Shear Force', `${maxV.toFixed(2)} kN`, `${checks.shear.Vc_Rd?.toFixed(2)} kN`, `${(checks.shear.ratio * 100).toFixed(1)}%`, checks.shear.ratio <= 1 ? 'PASS' : 'FAIL'],
        ['Deflection', `${maxDefl.toFixed(2)} mm`, `${checks.deflection.allowable?.toFixed(2)} mm`, `${(checks.deflection.ratio * 100).toFixed(1)}%`, checks.deflection.ratio <= 1 ? 'PASS' : 'FAIL'],
      ]
    });
    
    doc.save('TempWorks_Report.pdf');
  };

  return (
    <div className={styles.resultsContainer}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className={styles.calculateBtn} onClick={generatePDF}>Download PDF Report</button>
      </div>

      <div className={styles.resultsGrid}>
        <div className={styles.resultCard}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#64748b' }}>Bending Moment</h4>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            <span>{maxM.toFixed(2)}</span> / {checks.bending.Mc_Rd?.toFixed(2) || '?'} kNm
          </div>
          <div style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 'bold', background: checks.bending.ratio <= 1 ? '#dcfce7' : '#fee2e2', color: checks.bending.ratio <= 1 ? '#16a34a' : '#ef4444' }}>
            {(checks.bending.ratio * 100).toFixed(1)}% UR
          </div>
        </div>

        <div className={styles.resultCard}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#64748b' }}>Shear Force</h4>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            <span>{maxV.toFixed(2)}</span> / {checks.shear.Vc_Rd?.toFixed(2) || '?'} kN
          </div>
          <div style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 'bold', background: checks.shear.ratio <= 1 ? '#dcfce7' : '#fee2e2', color: checks.shear.ratio <= 1 ? '#16a34a' : '#ef4444' }}>
            {(checks.shear.ratio * 100).toFixed(1)}% UR
          </div>
        </div>

        <div className={styles.resultCard}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#64748b' }}>Deflection</h4>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            <span>{maxDefl.toFixed(2)}</span> / {checks.deflection.allowable?.toFixed(2) || '?'} mm
          </div>
          <div style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: 'bold', background: checks.deflection.ratio <= 1 ? '#dcfce7' : '#fee2e2', color: checks.deflection.ratio <= 1 ? '#16a34a' : '#ef4444' }}>
            {(checks.deflection.ratio * 100).toFixed(1)}% UR
          </div>
        </div>
      </div>

      <div className={styles.cardPanel} style={{ padding: '1rem', height: '400px' }}>
        <ResultCharts analysis={analysis} style={{ height: '100%' }} />
      </div>
    </div>
  );
}
