import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDesignCaseById, saveDesignCase } from '../../services/localDb';
import styles from './MultiSpanBeam.module.css';
import GeometryInput from './GeometryInput';
import LoadsInput from './LoadsInput';
import ResultsView from './ResultsView';
import { BeamSchematic } from '@engine/graphics';
import { analyzeBeam } from '@engine/beam';
import { getSectionByName, SECTIONS, STEEL_GRADES, SECTION_TYPES } from '@engine/materials';
import { performAllChecks } from '@engine/design/ec3';
import { Save, ArrowRight, ArrowLeft, Play, ArrowLeftCircle } from 'lucide-react';

export default function MultiSpanBeamCalculator() {
  const { projectId, dcId } = useParams();
  const navigate = useNavigate();
  
  // Steps: 1 (Geometry & Section), 2 (Loads), 3 (Results)
  const [step, setStep] = useState(1);
  const [hasCalculated, setHasCalculated] = useState(false);
  
  // State
  const [spans, setSpans] = useState([{ length: 5000, leftSupport: 'pin', rightSupport: 'roller' }]);
  const [loads, setLoads] = useState([{ type: 'udl', spanIndex: 0, magnitude: 10, posStart: 0, posEnd: 5000 }]);
  
  const [sectionType, setSectionType] = useState('IPE');
  const [sectionName, setSectionName] = useState('IPE 200');
  const [steelGrade, setSteelGrade] = useState('S235');
  
  const [results, setResults] = useState(null);

  useEffect(() => {
    const fetchCase = async () => {
      if (!dcId) return;
      const data = await getDesignCaseById(dcId);
      if (data) {
        if (data.spans) setSpans(data.spans);
        if (data.loads) setLoads(data.loads);
        if (data.sectionType) setSectionType(data.sectionType);
        if (data.sectionName) setSectionName(data.sectionName);
        if (data.steelGrade) setSteelGrade(data.steelGrade);
      }
    };
    fetchCase();
  }, [dcId]);

  // Invalidate results if inputs change
  useEffect(() => {
    setHasCalculated(false);
  }, [spans, loads, sectionType, sectionName, steelGrade]);

  const handleCalculate = () => {
    try {
      const E = 210000; // MPa
      const section = getSectionByName(sectionType, sectionName);
      if(!section) return;
      const I = section.Iy; // cm⁴ — solver converts to mm⁴ internally
      
      const { mesh, analysis: res } = analyzeBeam({ spans, loads, E, I });
      
      const maxM = Math.abs(res.maxMoment.value);
      const maxV = Math.abs(res.maxShear.value);
      const maxDefl = Math.abs(res.maxDeflection.value);
      
      res.physicalSpans = spans; // inject for deflection check

      const checks = performAllChecks(
        res,
        section,
        steelGrade,
        200
      );
      
      setResults({
        analysis: res,
        mesh,
        checks,
        maxM, maxV, maxDefl
      });
      setHasCalculated(true);
      setStep(3); // Auto advance to results
    } catch (e) {
      console.error("Calculation Error", e);
      alert('Error during calculation. Please check your inputs.');
    }
  };

  const handleSave = async () => {
    if (!dcId) return;
    try {
      await saveDesignCase({
        id: dcId,
        spans,
        loads,
        sectionType,
        sectionName,
        steelGrade
      });
      alert('Design Case saved successfully');
    } catch(err) {
      console.error(err);
      alert('Failed to save');
    }
  };

  return (
    <div className={styles.calculatorContainer}>
      {/* Header */}
      <header className={styles.calcHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate(`/projects/${projectId}`)}>
            <ArrowLeftCircle size={24} />
          </button>
          <div className={styles.titleBlock}>
            <h1>Multi-Span Beam Design</h1>
            <p>Design Case: {dcId}</p>
          </div>
        </div>
        <button className={styles.saveBtn} onClick={handleSave}>
          <Save size={18} /> Save Case
        </button>
      </header>

      {/* Stepper */}
      <div className={styles.stepper}>
        <div className={`${styles.step} ${step >= 1 ? styles.stepActive : ''}`} onClick={() => setStep(1)}>
          <div className={styles.stepNum}>1</div>
          <span>Geometry & Section</span>
        </div>
        <div className={styles.stepDivider} />
        <div className={`${styles.step} ${step >= 2 ? styles.stepActive : ''}`} onClick={() => setStep(2)}>
          <div className={styles.stepNum}>2</div>
          <span>Loads</span>
        </div>
        <div className={styles.stepDivider} />
        <div className={`${styles.step} ${step >= 3 && hasCalculated ? styles.stepActive : ''} ${!hasCalculated && step !== 3 ? styles.stepDisabled : ''}`} onClick={() => hasCalculated && setStep(3)}>
          <div className={styles.stepNum}>3</div>
          <span>Results & Checks</span>
        </div>
      </div>

      {/* Visualizer (Always visible in Step 1 & 2) */}
      {step < 3 && (
        <div className={styles.diagramWrapper}>
          <h3 className={styles.sectionTitle}>Beam Diagram</h3>
          <BeamSchematic spans={spans} loads={step === 2 ? loads : []} />
        </div>
      )}

      {/* Workspace */}
      <div className={styles.workspace}>
        {step === 1 && (
          <div className={styles.stepContent}>
            <div className={styles.grid2Col}>
              <div className={styles.cardPanel}>
                <GeometryInput spans={spans} setSpans={setSpans} />
              </div>
              <div className={styles.cardPanel}>
                <div className={styles.panelHeader}>
                  <h3>Section & Material</h3>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.formGroup}>
                    <label>Section Type</label>
                    <select value={sectionType} onChange={e => setSectionType(e.target.value)}>
                      {SECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Section Size</label>
                    <select value={sectionName} onChange={e => setSectionName(e.target.value)}>
                      {(SECTIONS[sectionType] || []).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Steel Grade</label>
                    <select value={steelGrade} onChange={e => setSteelGrade(e.target.value)}>
                      {Object.keys(STEEL_GRADES).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.stepActions}>
              <button className={styles.nextBtn} onClick={() => setStep(2)}>
                Next: Apply Loads <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <div className={styles.cardPanel}>
              <LoadsInput loads={loads} setLoads={setLoads} spans={spans} />
            </div>
            <div className={styles.stepActionsSpaceBetween}>
              <button className={styles.secondaryBtn} onClick={() => setStep(1)}>
                <ArrowLeft size={18} /> Back to Geometry
              </button>
              <button className={styles.calculateBtn} onClick={handleCalculate}>
                <Play size={18} /> Calculate Beam
              </button>
            </div>
          </div>
        )}

        {step === 3 && results && (
          <div className={styles.stepContent}>
            <div className={styles.stepActionsSpaceBetween} style={{ marginBottom: '1rem' }}>
              <button className={styles.secondaryBtn} onClick={() => setStep(2)}>
                <ArrowLeft size={18} /> Edit Loads
              </button>
            </div>
            <ResultsView results={results} sectionName={sectionName} />
          </div>
        )}
      </div>
    </div>
  );
}
