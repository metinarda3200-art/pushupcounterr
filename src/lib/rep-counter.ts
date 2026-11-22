/**
 * Pure rep-counting logic. Each frame carries:
 *  - angle: elbow angle in degrees (straight arms ≈ 170°)
 *  - height: shoulder distance from the hands, in torso lengths (shrinks toward the "bottom")
 *  - inPose: the body is in a valid push-up plank / pull-up hang
 *  - t: timestamp in ms
 *
 * A rep starts at the top (arms straight), travels to the bottom and comes back.
 *  - Elbow reaches `bottom` AND shoulders travel `fullTravel`, back to top -> +1
 *  - Elbow reaches `half` AND shoulders travel `halfTravel`, back to top   -> +0.5
 *  - Reached bottom but turned back down past halfway without the top     -> +0.5
 *  - Dipped a little but not enough                                       -> "shallow" (warning, no count)
 * Frames outside the pose are ignored; staying out of pose disarms the counter, so
 * standing up and waving the arms never counts.
 */

export type Exercise = "pushup" | "pullup";

export type Thresholds = {
  top: number;
  bottom: number;
  half: number;
  hysteresis: number;
  fullTravel: number;
  halfTravel: number;
  minRepMs: number;
  maxOutOfPoseMs: number;
};

export const THRESHOLDS: Record<Exercise, Thresholds> = {
  pushup: {
    top: 150,
    bottom: 95,
    half: 125,
    hysteresis: 10,
    fullTravel: 0.3,
    halfTravel: 0.15,
    minRepMs: 450,
    maxOutOfPoseMs: 500,
  },
  pullup: {
    top: 145,
    bottom: 80,
    half: 115,
    hysteresis: 10,
    fullTravel: 0.35,
    halfTravel: 0.18,
    minRepMs: 500,
    maxOutOfPoseMs: 600,
  },
};

export type Frame = { angle: number; height: number; inPose: boolean; t: number };

export type Phase = "up" | "descending" | "ascending";

export type CounterState = {
  phase: Phase;
  count: number;
  armed: boolean;
  minAngle: number;
  maxAngle: number;
  topHeight: number;
  minHeight: number;
  repStart: number;
  lastInPose: number;
};

export type RepEvent = "full" | "half" | "shallow" | null;

export function initialState(): CounterState {
  return {
    phase: "up",
    count: 0,
    armed: false,
    minAngle: 180,
    maxAngle: 0,
    topHeight: 0,
    minHeight: Infinity,
    repStart: 0,
    lastInPose: 0,
  };
}

export function step(
  state: CounterState,
  f: Frame,
  t: Thresholds,
): { state: CounterState; event: RepEvent } {
  const s = { ...state };
  let event = null as RepEvent;

  if (!f.inPose) {
    if (s.armed && f.t - s.lastInPose > t.maxOutOfPoseMs) {
      s.armed = false;
      s.phase = "up";
    }
    return { state: s, event };
  }
  s.lastInPose = f.t;

  if (!s.armed) {
    if (f.angle >= t.top) {
      s.armed = true;
      s.phase = "up";
      s.topHeight = f.height;
    }
    return { state: s, event };
  }

  const finishAtTop = () => {
    event = score(s, f.t, t);
    s.phase = "up";
    s.topHeight = f.height;
  };

  switch (s.phase) {
    case "up":
      s.topHeight = Math.max(s.topHeight, f.height);
      if (f.angle < t.top - t.hysteresis / 2) {
        s.phase = "descending";
        s.minAngle = f.angle;
        s.minHeight = f.height;
        s.repStart = f.t;
      }
      break;
    case "descending":
      s.minAngle = Math.min(s.minAngle, f.angle);
      s.minHeight = Math.min(s.minHeight, f.height);
      if (f.angle >= t.top) finishAtTop();
      else if (f.angle > s.minAngle + t.hysteresis) {
        s.phase = "ascending";
        s.maxAngle = f.angle;
      }
      break;
    case "ascending":
      s.maxAngle = Math.max(s.maxAngle, f.angle);
      if (f.angle >= t.top) finishAtTop();
      else if (f.angle < s.maxAngle - t.hysteresis) {
        const midway = (t.bottom + t.top) / 2;
        const travel = s.topHeight - s.minHeight;
        if (
          s.minAngle <= t.bottom &&
          travel >= t.fullTravel &&
          s.maxAngle >= midway &&
          f.t - s.repStart >= t.minRepMs
        ) {
          event = "half";
        }
        s.phase = "descending";
        s.minAngle = f.angle;
        s.minHeight = f.height;
        s.repStart = f.t;
      }
      break;
  }

  if (event === "full") s.count += 1;
  if (event === "half") s.count += 0.5;
  return { state: s, event };
}

function score(s: CounterState, now: number, t: Thresholds): RepEvent {
  const travel = s.topHeight - s.minHeight;
  if (now - s.repStart < t.minRepMs) return null; // jitter, too fast to be a real rep
  if (s.minAngle <= t.bottom && travel >= t.fullTravel) return "full";
  if (s.minAngle <= t.half && travel >= t.halfTravel) return "half";
  if (s.minAngle <= t.top - 15 && travel >= t.halfTravel / 3) return "shallow";
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
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag === 0) return 180;
  const cos = Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Turkish formatting: 12.5 -> "12,5" */
export function formatCount(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}
