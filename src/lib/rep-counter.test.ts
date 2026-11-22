import { describe, expect, it } from "vitest";
import { THRESHOLDS, angleAt, formatCount, initialState, step, type Thresholds } from "./rep-counter";

function run(angles: number[], t: Thresholds) {
  let s = initialState();
  for (const a of angles) s = step(s, a, t).state;
  return s.count;
}

const push = THRESHOLDS.pushup;
const pull = THRESHOLDS.pullup;

describe("şınav sayımı", () => {
  it("tam hareket aralığı 1 tekrar sayar", () => {
    expect(run([170, 150, 120, 100, 85, 100, 130, 165], push)).toBe(1);
  });

  it("yarıya kadar inip çıkmak 0,5 sayar", () => {
    expect(run([170, 150, 130, 118, 130, 165], push)).toBe(0.5);
  });

  it("çok küçük hareket hiç sayılmaz", () => {
    expect(run([170, 150, 140, 135, 150, 168], push)).toBe(0);
  });

  it("dibe inip yarıdan geri inmek 0,5 sayar", () => {
    expect(run([170, 130, 85, 110, 135, 120, 100, 85, 120, 165], push)).toBe(1.5);
  });

  it("üst pozisyon görülmeden sayım başlamaz", () => {
    expect(run([120, 85, 120, 85], push)).toBe(0);
  });

  it("art arda iki tam ve bir yarım tekrar 2,5 eder", () => {
    const full = [140, 90, 120, 160];
    const half = [140, 118, 135, 160];
    expect(run([170, ...full, ...full, ...half], push)).toBe(2.5);
  });
});

describe("barfiks sayımı", () => {
  it("asılıp çeneyi yukarı çıkarmak 1 tekrar sayar", () => {
    expect(run([170, 140, 100, 70, 100, 150, 168], pull)).toBe(1);
  });

  it("yarıya kadar çekmek 0,5 sayar", () => {
    expect(run([170, 140, 110, 125, 150], pull)).toBe(0.5);
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
