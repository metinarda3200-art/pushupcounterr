import { describe, expect, it } from "vitest";
import { nextCombo, rankFor, xpForRep } from "./game";

describe("XP", () => {
  it("tam şınav 10 XP, tam barfiks 20 XP", () => {
    expect(xpForRep("pushup", "full", 1)).toBe(10);
    expect(xpForRep("pullup", "full", 1)).toBe(20);
  });
  it("yarım tekrar yarım XP verir", () => {
    expect(xpForRep("pushup", "half", 5)).toBe(5);
  });
  it("combo her adımda %10 ekler, en fazla %100", () => {
    expect(xpForRep("pushup", "full", 3)).toBe(12);
    expect(xpForRep("pushup", "full", 50)).toBe(20);
  });
  it("yarım tekrar combo'yu bozar", () => {
    expect(nextCombo(4, "full")).toBe(5);
    expect(nextCombo(4, "half")).toBe(0);
  });
});

describe("rank", () => {
  it("0 XP Bronz III", () => {
    expect(rankFor(0).label).toBe("Bronz III");
  });
  it("500 XP Gümüş III, 1500 XP Altın III", () => {
    expect(rankFor(500).label).toBe("Gümüş III");
    expect(rankFor(1500).label).toBe("Altın III");
  });
  it("10000 XP Elmas, 25000 XP Şampiyon", () => {
    expect(rankFor(10000).tier.name).toBe("Elmas");
    expect(rankFor(25000).label).toBe("Şampiyon");
  });
  it("Bronz içinde 3 kademe vardır", () => {
    expect(rankFor(200).label).toBe("Bronz II");
    expect(rankFor(400).label).toBe("Bronz I");
  });
});
