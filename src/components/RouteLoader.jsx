import styles from './RouteLoader.module.css';

export default function RouteLoader({ full = false }) {
  return (
    <div className={`${styles.loader} ${full ? styles.loaderFull : ''}`} role="status" aria-label="Loading page">
      <span className={styles.spinner} />
    </div>
  );
}
