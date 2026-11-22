/**
 * Pure rep-counting logic driven by joint angles (degrees).
 * A rep starts at the "top" position, travels to the "bottom", and returns to the top.
 * - Full range (reaches bottom threshold) and returns to top  -> +1
 * - Only reaches the half threshold, then returns to top       -> +0.5
 * - Reaches bottom but turns back down halfway before the top  -> +0.5
 */

export type Exercise = "pushup" | "pullup";

export type Thresholds = {
  /** Angle at or above which the arms count as extended (start/end of a rep). */
  top: number;
  /** Angle at or below which the rep counts as full range. */
  bottom: number;
  /** Angle at or below which the rep counts as a half rep. */
  half: number;
  /** Degrees of reversal needed to detect a change of direction. */
  hysteresis: number;
};

export const THRESHOLDS: Record<Exercise, Thresholds> = {
  // Elbow angle: arms straight ~170°, chest near floor ~70-90°
  pushup: { top: 150, bottom: 95, half: 125, hysteresis: 10 },
  // Elbow angle: dead hang ~170°, chin over bar ~50-75°
  pullup: { top: 145, bottom: 80, half: 115, hysteresis: 10 },
};

export type Phase = "up" | "descending" | "ascending";

export type CounterState = {
  phase: Phase;
  count: number;
  minAngle: number;
  maxAngle: number;
  /** Has the user been seen at the top at least once? Reps only count after that. */
  armed: boolean;
};

export type RepEvent = "full" | "half" | null;

export function initialState(): CounterState {
  return { phase: "up", count: 0, minAngle: 180, maxAngle: 0, armed: false };
}

export function step(
  state: CounterState,
  angle: number,
  t: Thresholds,
): { state: CounterState; event: RepEvent } {
  const s = { ...state };
  let event: RepEvent = null;

  if (!s.armed) {
    if (angle >= t.top) {
      s.armed = true;
      s.phase = "up";
    }
    return { state: s, event };
  }

  switch (s.phase) {
    case "up":
      if (angle < t.top - t.hysteresis / 2) {
        s.phase = "descending";
        s.minAngle = angle;
      }
      break;
    case "descending":
      s.minAngle = Math.min(s.minAngle, angle);
      if (angle >= t.top) {
        // bounced straight back up
        event = scoreAtTop(s.minAngle, t);
        s.phase = "up";
      } else if (angle > s.minAngle + t.hysteresis) {
        s.phase = "ascending";
        s.maxAngle = angle;
      }
      break;
    case "ascending":
      s.maxAngle = Math.max(s.maxAngle, angle);
      if (angle >= t.top) {
        event = scoreAtTop(s.minAngle, t);
        s.phase = "up";
      } else if (angle < s.maxAngle - t.hysteresis) {
        // turned back down before reaching the top
        const midway = (t.bottom + t.top) / 2;
        if (s.minAngle <= t.bottom && s.maxAngle >= midway) event = "half";
        s.phase = "descending";
        s.minAngle = angle;
      }
      break;
  }

  if (event === "full") s.count += 1;
  if (event === "half") s.count += 0.5;
  return { state: s, event };
}

function scoreAtTop(minAngle: number, t: Thresholds): RepEvent {
  if (minAngle <= t.bottom) return "full";
  if (minAngle <= t.half) return "half";
  return null;
}

/** Angle ABC in degrees, with B as the vertex. */
export function angleAt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Turkish formatting: 12.5 -> "12,5" */
export function formatCount(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}
