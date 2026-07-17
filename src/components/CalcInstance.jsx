import { Fragment, createContext, useCallback, useContext, useState, useEffect } from 'react';
import TermsModal from './TermsModal';

/**
 * Calculators hydrate their state from sessionStorage in useState
 * initializers, so "loading a saved design" is: write the snapshot into
 * sessionStorage, then remount the calculator. This wrapper owns the
 * remount key; SavedDesigns calls useCalcReset() after applying a snapshot.
 */
const CalcResetContext = createContext(() => {});

export const useCalcReset = () => useContext(CalcResetContext);

export default function CalcInstance({ children }) {
  const [generation, setGeneration] = useState(0);
  const reset = useCallback(() => setGeneration((g) => g + 1), []);
  const [hasAccepted, setHasAccepted] = useState(true); // Default to true to prevent hydration flash

  useEffect(() => {
    const accepted = localStorage.getItem('tw_terms_accepted') === 'true';
    setHasAccepted(accepted);
  }, []);

  return (
    <CalcResetContext.Provider value={reset}>
      {!hasAccepted && (
        <TermsModal 
          isOpen={true} 
          requireAcceptance={true} 
          onAccept={() => setHasAccepted(true)} 
        />
      )}
      <Fragment key={generation}>{children}</Fragment>
    </CalcResetContext.Provider>
  );
}
