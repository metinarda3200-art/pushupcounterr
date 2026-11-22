import { describe, expect, it } from "vitest";
import { computeMetrics, type Landmark } from "./pose-metrics";

function pose(points: Record<number, [number, number]>): Landmark[] {
  return Array.from({ length: 33 }, (_, i) => {
    const p = points[i];
    return p ? { x: p[0], y: p[1], visibility: 0.95 } : { x: 0, y: 0, visibility: 0 };
  });
}

// Side view, square frame (aspect 1) for easy numbers.
const plankTop = pose({
  0: [0.8, 0.38], 11: [0.72, 0.42], 13: [0.72, 0.56], 15: [0.72, 0.7],
  23: [0.45, 0.5], 25: [0.3, 0.56], 27: [0.15, 0.62],
});
const standing = pose({
  0: [0.5, 0.15], 11: [0.5, 0.25], 13: [0.5, 0.38], 15: [0.5, 0.5],
  23: [0.5, 0.55], 25: [0.5, 0.75], 27: [0.5, 0.95],
});
const hanging = pose({
  0: [0.5, 0.3], 11: [0.5, 0.35], 13: [0.5, 0.22], 15: [0.5, 0.1],
  23: [0.5, 0.65], 25: [0.5, 0.82], 27: [0.5, 0.97],
});

describe("pozisyon kontrolü", () => {
  it("plank pozisyonu şınav için geçerlidir", () => {
    const m = computeMetrics(plankTop, "pushup", 1);
    expect(m.inPose).toBe(true);
    expect(m.angle).toBeGreaterThan(160);
  });

  it("ayakta durmak şınav pozisyonu sayılmaz", () => {
    expect(computeMetrics(standing, "pushup", 1).inPose).toBe(false);
  });

  it("bara asılı durmak barfiks pozisyonudur, ayakta durmak değildir", () => {
    expect(computeMetrics(hanging, "pullup", 1).inPose).toBe(true);
    expect(computeMetrics(standing, "pullup", 1).inPose).toBe(false);
  });

  it("görüntü oranı açıyı düzeltir", () => {
    // Same normalized points look bent on a wide frame if x is not scaled.
    const m = computeMetrics(plankTop, "pushup", 16 / 9);
    expect(m.angle).toBeGreaterThan(160);
  });
});
