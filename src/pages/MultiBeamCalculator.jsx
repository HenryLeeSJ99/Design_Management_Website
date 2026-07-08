import { useState } from 'react';
import { Save, FileText, Play } from 'lucide-react';
import styles from './MultiBeamCalculator.module.css';

export default function MultiBeamCalculator() {
  const [activeTab, setActiveTab] = useState('configuration');

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Multi Beam Span Calculator</h1>
          <p>Design and verify multi-span beam system</p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.projectSelect}>
            <option>Hospital Block A - Level 3</option>
          </select>
          <button className={styles.btnSecondary}>
            <Save size={16} /> Save
          </button>
          <button className={styles.btnSecondary}>
            <FileText size={16} /> Export PDF
          </button>
          <button className={styles.btnPrimary}>
            <Play size={16} fill="currentColor" /> Calculate
          </button>
        </div>
      </header>

      <div className={styles.tabs}>
        <div 
          className={`${styles.tab} ${activeTab === 'configuration' ? styles.active : ''}`}
          onClick={() => setActiveTab('configuration')}
        >
          Configuration
        </div>
        <div 
          className={`${styles.tab} ${activeTab === 'results' ? styles.active : ''}`}
          onClick={() => setActiveTab('results')}
        >
          Analysis Results
        </div>
        <div 
          className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`}
          onClick={() => setActiveTab('report')}
        >
          Report
        </div>
      </div>

      <div className={styles.contentArea}>
        {activeTab === 'configuration' && (
          <div className={styles.gridLayout}>
            {/* Left Column */}
            <div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>1. Beam Properties</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '300px' }}>
                  Beam Type, Material, Section Properties
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>2. Span & Supports</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '200px' }}>
                  Number of Spans, Lengths, Support Conditions
                </div>
              </div>
            </div>
            {/* Right Column */}
            <div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>3. Beam Layout</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '200px' }}>
                  Beam Layout Diagram
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>4. Loads</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '300px' }}>
                  Load Inputs & Load Diagram
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className={styles.resultsGridLayout}>
            {/* Left Column */}
            <div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Analysis Diagrams</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className={styles.placeholderBox}>Bending Moment</div>
                  <div className={styles.placeholderBox}>Shear Force</div>
                  <div className={styles.placeholderBox}>Deflection</div>
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Section Check Results</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '200px' }}>
                  Bending Stress, Shear Stress, Deflection Check Table
                </div>
              </div>
            </div>
            {/* Right Column */}
            <div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Design Summary</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '150px' }}>
                  PASS/FAIL, Max Utilization
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Key Results</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '200px' }}>
                  Max M, Max V, Max Defl, Reactions Table
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Notes</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '150px' }}>
                  Design Notes (Eurocode 3)
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div className={styles.card} style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <h3 className={styles.cardTitle}>Generated Report Preview</h3>
            <div className={styles.placeholderBox} style={{ minHeight: '600px' }}>
              Full PDF Report Preview
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
