import { THRESHOLDS, angleAt, type Exercise } from "./rep-counter";

export type Landmark = { x: number; y: number; z?: number; visibility?: number };

// MediaPipe Pose landmark indices
export const LM = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
} as const;

const vis = (l: Landmark | undefined) => l?.visibility ?? 0;

export type PoseMetrics = {
  /** Elbow angle used for counting, already adjusted per exercise. Null when arms aren't visible. */
  angle: number | null;
  /** Head, torso and legs are in frame. */
  bodyVisible: boolean;
  /** Pull-up only: nose is above the wrists (chin over the bar). */
  chinOverBar: boolean;
};

export function computeMetrics(lms: Landmark[], exercise: Exercise): PoseMetrics {
  const g = (i: number) => lms[i];
  const sides: Array<[number, number, number]> = [
    [LM.lShoulder, LM.lElbow, LM.lWrist],
    [LM.rShoulder, LM.rElbow, LM.rWrist],
  ];
  const angles: number[] = [];
  for (const [s, e, w] of sides) {
    const a = g(s);
    const b = g(e);
    const c = g(w);
    if (a && b && c && Math.min(vis(a), vis(b), vis(c)) > 0.5) angles.push(angleAt(a, b, c));
  }
  let angle = angles.length ? angles.reduce((x, y) => x + y, 0) / angles.length : null;

  const head = vis(g(LM.nose)) > 0.5;
  const torso = Math.max(vis(g(LM.lShoulder)), vis(g(LM.rShoulder))) > 0.5 && Math.max(vis(g(LM.lHip)), vis(g(LM.rHip))) > 0.5;
  const legs = Math.max(vis(g(LM.lKnee)), vis(g(LM.rKnee))) > 0.4;
  const bodyVisible = head && torso && legs;

  let chinOverBar = false;
  if (exercise === "pullup") {
    const nose = g(LM.nose);
    const wrists = [g(LM.lWrist), g(LM.rWrist)].filter((w): w is Landmark => !!w && vis(w) > 0.5);
    if (nose && vis(nose) > 0.5 && wrists.length) {
      const wy = wrists.reduce((s, w) => s + w.y, 0) / wrists.length;
      chinOverBar = nose.y < wy;
    }
    if (chinOverBar && angle !== null) angle = Math.min(angle, THRESHOLDS.pullup.bottom - 5);
  }

  return { angle, bodyVisible, chinOverBar };
}
