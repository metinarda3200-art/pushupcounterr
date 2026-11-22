import { useEffect, useRef, useState } from "react";

import { angleAt } from "@/lib/rep-counter";

type Pt = { x: number; y: number };

const FOOT: Pt = { x: 28, y: 92 };
const HAND: Pt = { x: 152, y: 92 };
const ARM = 21;
const PERIOD = 1900;

function solve(d: number) {
  const S = { x: 150 - 3 * d, y: 52 + 28 * d };
  const lerp = (k: number) => ({ x: FOOT.x + (S.x - FOOT.x) * k, y: FOOT.y + (S.y - FOOT.y) * k });
  const H = lerp(0.52);
  const K = lerp(0.27);
  const len = Math.hypot(S.x - FOOT.x, S.y - FOOT.y);
  const ux = (S.x - FOOT.x) / len;
  const uy = (S.y - FOOT.y) / len;
  const head = { x: S.x + ux * 14, y: S.y + uy * 14 - 3 };
  // two-bone IK for the elbow, bending back toward the feet
  const dx = HAND.x - S.x;
  const dy = HAND.y - S.y;
  const dist = Math.min(Math.hypot(dx, dy), ARM * 2 - 0.01);
  const h = Math.sqrt(Math.max(ARM * ARM - (dist / 2) ** 2, 0));
  const mx = S.x + dx / 2;
  const my = S.y + dy / 2;
  const px = -dy / Math.hypot(dx, dy);
  const py = dx / Math.hypot(dx, dy);
  const E = { x: mx + px * h, y: my + py * h };
  return { S, H, K, head, E };
}

/** Looping side-view stick figure doing push-ups, with a live rep counter. */
export function AnimatedSkeleton({ className }: { className?: string }) {
  const [d, setD] = useState(0);
  const [reps, setReps] = useState(0);
  const wasDown = useRef(false);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = ((now - start) % PERIOD) / PERIOD;
      const v = (1 - Math.cos(p * Math.PI * 2)) / 2;
      setD(v);
      if (v > 0.95) wasDown.current = true;
      if (v < 0.04 && wasDown.current) {
        wasDown.current = false;
        setReps((r) => r + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { S, H, K, head, E } = solve(d);
  const angle = Math.round(angleAt(S, E, HAND));
  const bones: [Pt, Pt][] = [
    [FOOT, K],
    [K, H],
    [H, S],
    [S, E],
    [E, HAND],
    [S, head],
  ];
  const joints = [FOOT, K, H, S, HAND];

  return (
    <div className={className}>
      <svg viewBox="0 0 200 110" className="h-full w-full" aria-label="Şınav çeken iskelet animasyonu">
        <line x1="6" y1="96" x2="194" y2="96" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 4" />
        <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.8">
          {bones.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          ))}
        </g>
        <circle cx={head.x} cy={head.y} r="6" fill="#fff" />
        {joints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.8" fill="#fff" stroke="#000" strokeOpacity="0.5" strokeWidth="0.8" />
        ))}
        <circle cx={E.x} cy={E.y} r="3.8" fill="#fff" stroke="var(--ember)" strokeWidth="2" />
        <text x={E.x - 8} y={E.y - 8} fontSize="7" fontFamily="JetBrains Mono, monospace" fill="var(--ember)">
          {angle}°
        </text>
      </svg>
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 animate-blink rounded-full bg-ember" /> Canlı takip
        </span>
        <span>
          Tekrar <span className="text-bone">{reps}</span>
        </span>
      </div>
    </div>
  );
}
