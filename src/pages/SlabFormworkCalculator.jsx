import { useState } from 'react';
import { Save, FileText, Play } from 'lucide-react';
import styles from './SlabFormworkCalculator.module.css';

export default function SlabFormworkCalculator() {
  const [activeTab, setActiveTab] = useState('configuration');

  return (
    <div className={styles.pageContainer}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1>Slab Formwork Check</h1>
          <p>Design and verify your slab formwork system</p>
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
          System Configuration
        </div>
        <div 
          className={`${styles.tab} ${activeTab === 'results' ? styles.active : ''}`}
          onClick={() => setActiveTab('results')}
        >
          Check Results
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
                <h3 className={styles.cardTitle}>1. Slab</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '120px' }}>
                  Thickness, Concrete Grade, Density
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>2. Formwork Deck (Panel)</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '120px' }}>
                  Panel Type, Direction, Self Weight
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>3. Secondary Beam</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '120px' }}>
                  Beam Type, Spacing
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>4. Primary Beam</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '120px' }}>
                  Beam Type, Spacing
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>5. Shoring (Tower)</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '120px' }}>
                  Shoring Type, Height, Grid Spacing
                </div>
              </div>
            </div>
            {/* Right Column */}
            <div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>System Layout (Plan View)</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '350px' }}>
                  Plan View Diagram (Interactive)
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>System Elevation (Typical Section)</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '350px' }}>
                  Elevation View Diagram (Interactive)
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
                <h3 className={styles.cardTitle}>Component Check Results</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '400px' }}>
                  Table: Component, Design Capacity, Applied Load, Utilization, Status
                  (Plywood, Secondary, Primary, Shoring Tower, Deflection Check)
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Notes</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '150px' }}>
                  Design based on BS 5975, Contractor instructions, etc.
                </div>
              </div>
            </div>
            {/* Right Column */}
            <div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Design Summary</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '150px' }}>
                  PASS/FAIL, Max Utilization, Max Tower Reaction
                </div>
              </div>
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>Load Summary (Service Load)</h3>
                <div className={styles.placeholderBox} style={{ minHeight: '250px' }}>
                  Concrete Self Weight, Formwork Weight, Live Load -> Total Service Load
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
