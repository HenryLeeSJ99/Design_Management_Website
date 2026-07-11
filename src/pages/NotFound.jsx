import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Home, ArrowLeft } from 'lucide-react';
import styles from './NotFound.module.css';

export default function NotFound() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Animated beam diagram background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // Animated beam supports
      const beams = 6;
      for (let i = 0; i < beams; i++) {
        const y = H * 0.35 + Math.sin(t * 0.8 + i * 1.2) * 30;
        const x0 = (W / (beams + 1)) * (i + 1);

        // Vertical support
        ctx.beginPath();
        ctx.moveTo(x0, y + 60);
        ctx.lineTo(x0, y + 140);
        ctx.strokeStyle = `hsla(220, 14%, ${40 + i * 4}%, 0.35)`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Support triangle
        ctx.beginPath();
        ctx.moveTo(x0, y + 140);
        ctx.lineTo(x0 - 14, y + 165);
        ctx.lineTo(x0 + 14, y + 165);
        ctx.closePath();
        ctx.strokeStyle = `hsla(220, 14%, ${38 + i * 3}%, 0.3)`;
        ctx.stroke();

        // Node circle
        ctx.beginPath();
        ctx.arc(x0, y + 60, 6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(221, 83%, ${60 + i * 3}%, 0.5)`;
        ctx.fill();
      }

      // Horizontal beam
      const y0 = H * 0.35 + Math.sin(t * 0.8) * 12;
      ctx.beginPath();
      ctx.moveTo(W * 0.06, y0 + 60);
      ctx.lineTo(W * 0.94, y0 + 60);
      ctx.strokeStyle = 'hsla(221, 83%, 65%, 0.25)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Load arrows
      for (let i = 0; i < 5; i++) {
        const ax = W * 0.15 + (W * 0.7 / 4) * i;
        const len = 28 + Math.sin(t + i) * 4;
        ctx.beginPath();
        ctx.moveTo(ax, y0 + 60 - len - 6);
        ctx.lineTo(ax, y0 + 60 - 6);
        ctx.strokeStyle = 'hsla(210, 80%, 65%, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(ax, y0 + 60 - 6);
        ctx.lineTo(ax - 5, y0 + 60 - 16);
        ctx.lineTo(ax + 5, y0 + 60 - 16);
        ctx.closePath();
        ctx.fillStyle = 'hsla(210, 80%, 65%, 0.25)';
        ctx.fill();
      }

      if (!reduceMotion) {
        t += 0.012;
        raf = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.gridOverlay} />

      <div className={styles.content}>
        <div className={styles.code}>404</div>

        <div className={styles.badge}>Structural error</div>

        <h1 className={styles.title}>Page not found</h1>

        <p className={styles.subtitle}>
          This load path doesn&apos;t resolve to any known element.
          The page you&apos;re looking for may have moved or never existed.
        </p>

        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={() => navigate('/')}>
            <Home size={16} strokeWidth={2.2} />
            Back to home
          </button>

          <button className={styles.secondaryBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={16} strokeWidth={2.2} />
            Go back
          </button>
        </div>

        <p className={styles.footnote}>PLYTEC Design Management - Structural Calculators</p>
      </div>
    </div>
  );
}
