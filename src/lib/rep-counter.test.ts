import { describe, expect, it } from "vitest";
import {
  THRESHOLDS,
  angleAt,
  formatCount,
  initialState,
  step,
  type Frame,
  type Thresholds,
} from "./rep-counter";

/** Body moves with the elbow: straight arms (170°) ≈ 1.2 torso lengths, 85° ≈ 0.35. */
const heightFor = (angle: number) => 0.35 + ((angle - 85) / 85) * 0.85;

function frames(angles: number[], opts: { inPose?: boolean; still?: boolean; dt?: number } = {}): Frame[] {
  const dt = opts.dt ?? 200;
  return angles.map((angle, i) => ({
    angle,
    height: opts.still ? 1.2 : heightFor(angle),
    inPose: opts.inPose ?? true,
    t: i * dt,
  }));
}

function run(list: Frame[], t: Thresholds) {
  let s = initialState();
  const events: string[] = [];
  for (const f of list) {
    const r = step(s, f, t);
    s = r.state;
    if (r.event) events.push(r.event);
  }
  return { count: s.count, events };
}

const push = THRESHOLDS.pushup;
const pull = THRESHOLDS.pullup;

describe("şınav sayımı", () => {
  it("tam hareket aralığı 1 tekrar sayar", () => {
    expect(run(frames([170, 150, 120, 100, 85, 100, 130, 165]), push).count).toBe(1);
  });

  it("yarıya kadar inip çıkmak 0,5 sayar", () => {
    expect(run(frames([170, 150, 130, 118, 130, 150, 165]), push).count).toBe(0.5);
  });

  it("çok az inmek sayılmaz ve uyarı verir", () => {
    const r = run(frames([170, 150, 140, 133, 145, 168]), push);
    expect(r.count).toBe(0);
    expect(r.events).toContain("shallow");
  });

  it("dibe inip yarıdan geri inmek 0,5 sayar", () => {
    expect(run(frames([170, 130, 85, 110, 135, 120, 100, 85, 120, 165]), push).count).toBe(1.5);
  });

  it("üst pozisyon görülmeden sayım başlamaz", () => {
    expect(run(frames([120, 85, 120, 85]), push).count).toBe(0);
  });

  it("şınav pozisyonunda değilken kol hareketleri sayılmaz", () => {
    expect(run(frames([170, 120, 85, 120, 170, 120, 85, 170], { inPose: false }), push).count).toBe(0);
  });

  it("omuzlar yer değiştirmeden sadece dirsek bükmek sayılmaz", () => {
    expect(run(frames([170, 140, 110, 85, 110, 140, 170], { still: true }), push).count).toBe(0);
  });

  it("çok hızlı titreme tekrar sayılmaz", () => {
    expect(run(frames([170, 120, 85, 120, 170], { dt: 40 }), push).count).toBe(0);
  });

  it("pozisyondan çıkınca sayaç yeniden başlangıç pozisyonu bekler", () => {
    const list: Frame[] = [
      ...frames([170, 150]),
      { angle: 170, height: 1.2, inPose: false, t: 400 },
      { angle: 170, height: 1.2, inPose: false, t: 1200 },
      // back in frame mid-rep (no top seen yet): must not count
      ...frames([100, 85, 120, 165]).map((f) => ({ ...f, t: 1400 + f.t })),
    ];
    expect(run(list, push).count).toBe(0);
  });

  it("art arda iki tam ve bir yarım tekrar 2,5 eder", () => {
    const full = [140, 90, 120, 160];
    const half = [140, 118, 135, 160];
    expect(run(frames([170, ...full, ...full, ...half]), push).count).toBe(2.5);
  });
});

describe("barfiks sayımı", () => {
  it("asılıp çeneyi yukarı çıkarmak 1 tekrar sayar", () => {
    expect(run(frames([170, 140, 100, 70, 100, 150, 168], { dt: 200 }), pull).count).toBe(1);
  });

  it("yarıya kadar çekmek 0,5 sayar", () => {
    expect(run(frames([170, 140, 125, 110, 125, 140, 150], { dt: 200 }), pull).count).toBe(0.5);
  });
});

describe("yardımcılar", () => {
  it("dik açıyı 90 derece hesaplar", () => {
    expect(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
  });
  it("yarım tekrarı virgülle yazar", () => {
    expect(formatCount(12.5)).toBe("12,5");
    expect(formatCount(3)).toBe("3");
  });
});
