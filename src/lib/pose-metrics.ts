import { THRESHOLDS, angleAt, type Exercise } from "./rep-counter";

export type Landmark = { x: number; y: number; z?: number; visibility?: number };
type P = { x: number; y: number; v: number };

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

const VIS = 0.6;

export type PoseIssue = "arms" | "body" | "pose" | null;

export type PoseMetrics = {
  /** Elbow angle used for counting (pull-up: forced low when the chin clears the bar). */
  angle: number | null;
  /** Shoulder distance from the hands in torso lengths. */
  height: number;
  /** In a valid push-up plank / pull-up hang. */
  inPose: boolean;
  /** Head, torso and legs are in frame. */
  bodyVisible: boolean;
  chinOverBar: boolean;
  issue: PoseIssue;
};

/**
 * @param aspect video width / height. Landmarks are normalized per axis, so x is scaled by
 * the aspect ratio to measure real angles and distances.
 */
export function computeMetrics(lms: Landmark[], exercise: Exercise, aspect = 4 / 3): PoseMetrics {
  const g = (i: number): P | null => {
    const l = lms[i];
    return l ? { x: l.x * aspect, y: l.y, v: l.visibility ?? 0 } : null;
  };
  const empty: PoseMetrics = { angle: null, height: 0, inPose: false, bodyVisible: false, chinOverBar: false, issue: "arms" };

  // Use the side of the body facing the camera (best visibility) instead of averaging in the hidden arm.
  const sides = [
    { s: g(LM.lShoulder), e: g(LM.lElbow), w: g(LM.lWrist), h: g(LM.lHip), k: g(LM.lKnee) },
    { s: g(LM.rShoulder), e: g(LM.rElbow), w: g(LM.rWrist), h: g(LM.rHip), k: g(LM.rKnee) },
  ];
  const scored = sides
    .map((side) => ({
      side,
      score: Math.min(side.s?.v ?? 0, side.e?.v ?? 0, side.w?.v ?? 0, side.h?.v ?? 0),
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < VIS) return empty;
  const { s, e, w, h, k } = best.side;
  if (!s || !e || !w || !h) return empty;

  const nose = g(LM.nose);
  const bodyVisible =
    (nose?.v ?? 0) > 0.5 && Math.max(g(LM.lKnee)?.v ?? 0, g(LM.rKnee)?.v ?? 0) > 0.4;

  let angle = angleAt(s, e, w);
  const torso = Math.hypot(s.x - h.x, s.y - h.y);
  if (torso < 0.04) return { ...empty, angle, issue: "body" };

  let inPose = false;
  let height = 0;
  let chinOverBar = false;

  if (exercise === "pushup") {
    const dx = Math.abs(s.x - h.x);
    const dy = Math.abs(s.y - h.y);
    const horizontal = dy < dx * 0.85; // torso within ~40° of the floor
    const handsDown = w.y > s.y - 0.1 * torso; // hands at or below shoulder level
    const handsUnder = Math.abs(w.x - s.x) < 0.9 * torso;
    const straight = !k || k.v < 0.5 || angleAt(s, h, k) > 130; // no deep pike / kneeling fold
    inPose = horizontal && handsDown && handsUnder && straight;
    height = (w.y - s.y) / torso;
  } else {
    const dx = Math.abs(s.x - h.x);
    const dy = h.y - s.y;
    const upright = dy > 0 && dx < dy * 0.7;
    const handsUp = w.y < s.y + 0.1 * torso;
    inPose = upright && handsUp;
    height = (s.y - w.y) / torso;
    const wrists = [g(LM.lWrist), g(LM.rWrist)].filter((p): p is P => !!p && p.v > 0.5);
    if (nose && nose.v > 0.5 && wrists.length) {
      const wy = wrists.reduce((acc, p) => acc + p.y, 0) / wrists.length;
      chinOverBar = nose.y < wy;
    }
    if (chinOverBar) angle = Math.min(angle, THRESHOLDS.pullup.bottom - 5);
  }

  return { angle, height, inPose, bodyVisible, chinOverBar, issue: inPose ? null : "pose" };
}
