import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';
import Logo from './Logo';

export default function SplashScreen({ onFinish }) {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fading out slightly before the full duration
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 950); // Start fade out at 0.95s

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 1250); // Full unmount at 1.25s

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`${styles.splashContainer} ${isFadingOut ? styles.fadeOut : ''}`}>
      <div className={styles.logoWrapper}>
        <Logo width={240} light={false} />
      </div>
    </div>
  );
}
