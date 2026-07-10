import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export default function NotFound() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Animated beam SVG background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      // Draw animated beam lines
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

        // Moment circle
        ctx.beginPath();
        ctx.arc(x0, y + 60, 6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(217, 91%, ${65 + i * 3}%, 0.5)`;
        ctx.fill();
      }

      // Horizontal beam
      const y0 = H * 0.35 + Math.sin(t * 0.8) * 12;
      ctx.beginPath();
      ctx.moveTo(W * 0.06, y0 + 60);
      ctx.lineTo(W * 0.94, y0 + 60);
      ctx.strokeStyle = 'hsla(217, 91%, 70%, 0.25)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Load arrows
      for (let i = 0; i < 5; i++) {
        const ax = W * 0.15 + (W * 0.7 / 4) * i;
        const len = 28 + Math.sin(t + i) * 4;
        ctx.beginPath();
        ctx.moveTo(ax, y0 + 60 - len - 6);
        ctx.lineTo(ax, y0 + 60 - 6);
        ctx.strokeStyle = 'hsla(195, 80%, 65%, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(ax, y0 + 60 - 6);
        ctx.lineTo(ax - 5, y0 + 60 - 16);
        ctx.lineTo(ax + 5, y0 + 60 - 16);
        ctx.closePath();
        ctx.fillStyle = 'hsla(195, 80%, 65%, 0.25)';
        ctx.fill();
      }

      t += 0.012;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Animated beam canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(hsla(217,91%,70%,0.04) 1px, transparent 1px),
          linear-gradient(90deg, hsla(217,91%,70%,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        padding: '40px 24px',
        maxWidth: '560px',
        width: '100%',
      }}>
        {/* 404 number */}
        <div style={{
          fontSize: 'clamp(80px, 18vw, 160px)',
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          background: 'linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #38bdf8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '8px',
          userSelect: 'none',
        }}>
          404
        </div>

        {/* Engineering badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'hsla(217, 91%, 60%, 0.12)',
          border: '1px solid hsla(217, 91%, 60%, 0.25)',
          borderRadius: '999px',
          padding: '4px 14px',
          marginBottom: '28px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
          <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Structural Error
          </span>
        </div>

        <h1 style={{
          color: '#f1f5f9',
          fontSize: 'clamp(22px, 5vw, 32px)',
          fontWeight: 700,
          margin: '0 0 12px',
          letterSpacing: '-0.02em',
        }}>
          Page Not Found
        </h1>

        <p style={{
          color: '#94a3b8',
          fontSize: '16px',
          lineHeight: 1.65,
          margin: '0 0 40px',
        }}>
          This load path doesn't resolve to any known element.
          The page you're looking for may have moved or never existed.
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/calculators/multi-beam')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.32,0.72,0,1)',
              boxShadow: '0 4px 24px hsla(217,91%,60%,0.35)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 32px hsla(217,91%,60%,0.45)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.boxShadow = '0 4px 24px hsla(217,91%,60%,0.35)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            Go to Calculator
          </button>

          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'hsla(220, 14%, 100%, 0.06)',
              color: '#cbd5e1',
              border: '1px solid hsla(220, 14%, 100%, 0.12)',
              borderRadius: '12px',
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.32,0.72,0,1)',
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.background = 'hsla(220,14%,100%,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = '';
              e.currentTarget.style.background = 'hsla(220,14%,100%,0.06)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Go Back
          </button>
        </div>

        {/* Footer note */}
        <p style={{ color: '#475569', fontSize: '13px', marginTop: '48px' }}>
          TempWorks Design Management &mdash; Structural Calculators
        </p>
      </div>
    </div>
  );
}
