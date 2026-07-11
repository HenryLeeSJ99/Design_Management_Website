import { Link } from 'react-router-dom';
import { SquareMenu, Layers, Building, ChevronsUp, Columns, Cuboid, ArrowRight } from 'lucide-react';
import styles from './Home.module.css';

const calculators = [
  {
    name: 'Multi Beam Span',
    path: '/calculators/multi-beam',
    icon: SquareMenu,
    description: 'Continuous beam analysis with shear, moment and deflection results.',
  },
  {
    name: 'Slab Formwork',
    path: '/calculators/slab-formwork',
    icon: Layers,
    description: 'Size joists, bearers and props for slab pours.',
  },
  {
    name: 'Wall Formwork',
    path: '/calculators/wall-formwork',
    icon: Building,
    description: 'Fresh concrete pressure on vertical formwork.',
  },
];

const upcoming = [
  { name: 'Shoring Tower', icon: ChevronsUp },
  { name: 'Column Formwork', icon: Columns },
  { name: 'Beam Formwork', icon: Cuboid },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const HEADLINE_WORDS = ['What', 'would', 'you', 'do', 'today?'];

export default function Home() {
  return (
    <div className={styles.home}>
      <div className={styles.inner}>
        <p className={styles.greeting}>{getGreeting()}</p>

        <h1 className={styles.headline} aria-label="What would you do today?">
          {HEADLINE_WORDS.map((word, i) => (
            <span key={word} className={styles.wordMask} aria-hidden="true">
              <span className={styles.word} style={{ '--i': i }}>{word}</span>
            </span>
          ))}
        </h1>

        <nav className={styles.menu} aria-label="Calculators">
          {calculators.map((calc, i) => (
            <Link key={calc.name} to={calc.path} className={styles.card} style={{ '--i': i }}>
              <span className={styles.cardIcon}>
                <calc.icon size={22} strokeWidth={1.8} />
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardName}>{calc.name}</span>
                <span className={styles.cardDesc}>{calc.description}</span>
              </span>
              <ArrowRight size={18} className={styles.cardArrow} />
            </Link>
          ))}
        </nav>

        <div className={styles.upcoming}>
          <span className={styles.upcomingLabel}>Coming soon</span>
          <div className={styles.chips}>
            {upcoming.map((item) => (
              <span key={item.name} className={styles.chip}>
                <item.icon size={14} strokeWidth={1.8} />
                {item.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
