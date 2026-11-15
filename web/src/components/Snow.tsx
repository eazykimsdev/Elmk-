import { useEffect, useRef, useState } from 'react';
import { currentTheme } from '@/lib/theme';

const KEY = 'erlc_snow';
const SHOW_ON = (p: string) => p === '/' || p.startsWith('/dashboard') || p === '/directory' || p.startsWith('/directory');

/** Subtle snow: few small slow flakes, canvas, pointer-events none. Christmas theme only. */
export function Snow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [theme, setTheme] = useState(currentTheme());
  const [path, setPath] = useState(window.location.pathname);
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
  });
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const onTheme = () => setTheme(currentTheme());
    const onSnow = () => {
      try { setEnabled(localStorage.getItem(KEY) !== 'off'); } catch {}
    };
    window.addEventListener('erlc-theme-change', onTheme);
    window.addEventListener('erlc-snow-change', onSnow);
    window.addEventListener('storage', onSnow);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener('change', onMq);
    const poll = window.setInterval(() => setPath((p) => (p === window.location.pathname ? p : window.location.pathname)), 1000);
    return () => {
      window.removeEventListener('erlc-theme-change', onTheme);
      window.removeEventListener('erlc-snow-change', onSnow);
      window.removeEventListener('storage', onSnow);
      mq.removeEventListener('change', onMq);
      window.clearInterval(poll);
    };
  }, []);

  const active = theme === 'christmas' && SHOW_ON(path);
  const running = active && enabled && !reduced;

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const small = window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches;
    const COUNT = small ? 26 : 48;
    let w = 0, h = 0, raf = 0, last = 0;
    const dpr = 1; // keep cheap on phones

    // Distinct flake distribution: round dots mixed with real snowflake shapes
    const flakes = Array.from({ length: COUNT }, (_, i) => {
      const sizeTier = i % 3;
      const radius = sizeTier === 0 ? (1.0 + Math.random() * 0.5) : sizeTier === 1 ? (1.8 + Math.random() * 0.6) : (2.6 + Math.random() * 0.7);
      const shapeType = i % 3 === 0 ? 'snowflake' : i % 3 === 1 ? 'star' : 'dot';
      return {
        x: Math.random(),
        y: Math.random(),
        r: radius,
        shape: shapeType,
        v: 11 + Math.random() * 14,             // slow gentle fall px/s
        swayAngle: Math.random() * Math.PI * 2, // smooth subtle drift
        swaySpeed: 0.7 + Math.random() * 0.8,
        swayAmplitude: 0.00012 + Math.random() * 0.00018, // fall straight down with tiny soft sway
        o: sizeTier === 2 ? (0.22 + Math.random() * 0.15) : (0.28 + Math.random() * 0.18), // soft low opacity
      };
    });
    const color = getComputedStyle(document.documentElement).getPropertyValue('--snow-color').trim() || '255,255,255';

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; // cap at smooth ~30fps for minimal CPU & battery on mobile
      const dt = Math.min(0.1, (t - last) / 1000 || 0.033);
      last = t;
      ctx.clearRect(0, 0, w, h);

      for (const f of flakes) {
        f.y += (f.v * dt) / h;
        f.swayAngle += f.swaySpeed * dt;
        f.x += Math.sin(f.swayAngle) * f.swayAmplitude;

        if (f.y > 1.02) {
          f.y = -0.02;
          f.x = Math.random();
        }
        if (f.x > 1.02) f.x = -0.02;
        else if (f.x < -0.02) f.x = 1.02;

        const cx = f.x * w;
        const cy = f.y * h;

        if (f.shape === 'snowflake') {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.strokeStyle = `rgba(${color},${f.o * 0.95})`;
          ctx.lineWidth = Math.max(0.7, f.r * 0.28);
          // 6-pointed branching crystalline snowflake
          for (let a = 0; a < 3; a++) {
            ctx.beginPath();
            ctx.moveTo(-f.r * 1.8, 0);
            ctx.lineTo(f.r * 1.8, 0);
            // tiny branching twigs
            const branchOffset = f.r * 0.9;
            const branchLen = f.r * 0.45;
            ctx.moveTo(-branchOffset, 0);
            ctx.lineTo(-branchOffset - branchLen, -branchLen);
            ctx.moveTo(-branchOffset, 0);
            ctx.lineTo(-branchOffset - branchLen, branchLen);
            ctx.moveTo(branchOffset, 0);
            ctx.lineTo(branchOffset + branchLen, -branchLen);
            ctx.moveTo(branchOffset, 0);
            ctx.lineTo(branchOffset + branchLen, branchLen);
            ctx.stroke();
            ctx.rotate(Math.PI / 3);
          }
          ctx.restore();
        } else if (f.shape === 'star') {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.strokeStyle = `rgba(${color},${f.o * 0.9})`;
          ctx.lineWidth = Math.max(0.75, f.r * 0.35);
          for (let a = 0; a < 3; a++) {
            ctx.beginPath();
            ctx.moveTo(-f.r * 1.5, 0);
            ctx.lineTo(f.r * 1.5, 0);
            ctx.stroke();
            ctx.rotate(Math.PI / 3);
          }
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.fillStyle = `rgba(${color},${f.o})`;
          ctx.arc(cx, cy, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', resize);
    };
  }, [running]);

  if (!active) return null;

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch {}
    window.dispatchEvent(new Event('erlc-snow-change'));
  };

  return (
    <>
      {running && <canvas ref={canvasRef} aria-hidden="true" className="snow-canvas" />}
      <button
        type="button"
        onClick={toggle}
        className="snow-toggle"
        aria-label={enabled ? 'Turn off snowfall animation' : 'Turn on snowfall animation'}
        title={enabled ? 'Snow: On (Click to turn off)' : 'Snow: Off (Click to turn on)'}
      >
        <span className="text-xs">{enabled ? '❄ Snow on' : 'Snow off'}</span>
      </button>
    </>
  );
}
