import { useTheme } from '../contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

/**
 * Animated Sun ↔ Moon theme toggle.
 *
 * Uses SVG masking to morph a sun into a crescent moon, with rotating rays
 * that collapse and tiny stars that bloom on dark mode. All animation is
 * CSS-driven — no extra dependencies.
 *
 * Inspiration:
 *  - https://github.com/JoseRFelix/react-toggle-dark-mode
 *  - https://web.dev/patterns/theming/theme-switch
 *  - https://jfelix.info/blog/using-react-spring-to-animate-svg-icons-dark-mode-toggle
 *
 * @param {'sidebar' | 'header'} variant — controls sizing
 */
export default function ThemeToggle({ variant = 'sidebar' }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const toggle = () => setTheme(isDark ? 'light' : 'dark');

  const size = variant === 'header' ? 22 : 18;

  return (
    <button
      type="button"
      className={`${styles.toggle} ${styles[variant]} ${isDark ? styles.dark : styles.light}`}
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <svg
        className={styles.icon}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* The mask circle that "bites" into the sun to make a crescent */}
          <mask id={`moon-mask-${variant}`}>
            <rect x="0" y="0" width="24" height="24" fill="white" />
            <circle
              className={styles.maskCircle}
              cx={isDark ? 17 : 33}
              cy={isDark ? 7 : -3}
              r="8"
              fill="black"
            />
          </mask>
        </defs>

        {/* ── Core body (sun disc → moon crescent) ── */}
        <circle
          className={styles.body}
          cx="12"
          cy="12"
          r={isDark ? 8 : 5}
          fill="currentColor"
          mask={`url(#moon-mask-${variant})`}
        />

        {/* ── Sun rays — eight lines radiating from centre ── */}
        <g className={`${styles.rays} ${isDark ? styles.raysHidden : ''}`}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line
              key={angle}
              x1="12"
              y1="1.5"
              x2="12"
              y2="4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${angle} 12 12)`}
            />
          ))}
        </g>

        {/* ── Stars — tiny dots that bloom in dark mode ── */}
        <g className={`${styles.stars} ${isDark ? styles.starsVisible : ''}`}>
          <circle cx="19" cy="4" r="0.8" fill="currentColor" />
          <circle cx="21" cy="9" r="0.6" fill="currentColor" />
          <circle cx="4" cy="5" r="0.7" fill="currentColor" />
          <circle cx="3" cy="18" r="0.5" fill="currentColor" />
          <circle cx="21" cy="18" r="0.6" fill="currentColor" />
        </g>
      </svg>

      {variant === 'sidebar' && (
        <span className={styles.label}>
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}
