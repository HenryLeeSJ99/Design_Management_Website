import { Component } from 'react';
import styles from './ErrorBoundary.module.css';

const RELOAD_FLAG = 'tw_chunk_reload_attempted';

function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(msg);
}

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // A failed dynamic import usually means the deployed chunk hashes moved
    // on from what this tab has in memory (stale index.html after a
    // redeploy). One automatic reload fetches the current index.html and
    // resolves it; a sessionStorage flag stops a genuine repeated failure
    // from reload-looping the tab.
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.subtitle}>
            This page failed to load. Reloading usually fixes it, especially right after an update.
          </p>
          <div className={styles.actions}>
            <button
              className={styles.primaryBtn}
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <button
              className={styles.secondaryBtn}
              onClick={() => { window.location.href = '/'; }}
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
