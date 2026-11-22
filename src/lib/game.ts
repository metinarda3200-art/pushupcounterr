import type { Exercise, RepEvent } from "./rep-counter";

/** Base XP per rep. Pull-ups are harder, so they are worth double. */
export const BASE_XP: Record<Exercise, number> = { pushup: 10, pullup: 20 };

/**
 * XP for one counted rep. Full reps build a combo: each step adds +10% up to +100%.
 * Half reps give half the base XP and no combo bonus.
 */
export function xpForRep(exercise: Exercise, event: RepEvent, combo: number): number {
  const base = BASE_XP[exercise];
  if (event === "half") return Math.round(base / 2);
  if (event !== "full") return 0;
  const bonus = Math.min(Math.max(combo - 1, 0), 10) * 0.1;
  return Math.round(base * (1 + bonus));
}

/** Combo after an event: full reps extend it, anything else breaks it. */
export function nextCombo(combo: number, event: RepEvent): number {
  if (event === "full") return combo + 1;
  if (event === "half" || event === "shallow") return 0;
  return combo;
}

export type TierId = "bronz" | "gumus" | "altin" | "platin" | "elmas" | "sampiyon";

export const TIERS: { id: TierId; name: string; min: number }[] = [
  { id: "bronz", name: "Bronz", min: 0 },
  { id: "gumus", name: "Gümüş", min: 500 },
  { id: "altin", name: "Altın", min: 1500 },
  { id: "platin", name: "Platin", min: 4000 },
  { id: "elmas", name: "Elmas", min: 10000 },
  { id: "sampiyon", name: "Şampiyon", min: 25000 },
];

const DIVISIONS = ["III", "II", "I"] as const;

export type Rank = {
  tier: (typeof TIERS)[number];
  tierIndex: number;
  division: (typeof DIVISIONS)[number] | null;
  label: string;
  /** XP where the current division starts / the next one starts (null at the very top). */
  floor: number;
  next: number | null;
  /** 0..1 progress to the next division. */
  progress: number;
};

export function rankFor(xpRaw: number): Rank {
  const xp = Math.max(0, xpRaw);
  let tierIndex = 0;
  TIERS.forEach((t, i) => {
    if (xp >= t.min) tierIndex = i;
  });
  const tier = TIERS[tierIndex]!;
  const nextTier = TIERS[tierIndex + 1];
  if (!nextTier) {
    return { tier, tierIndex, division: null, label: tier.name, floor: tier.min, next: null, progress: 1 };
  }
  const span = (nextTier.min - tier.min) / 3;
  const d = Math.min(2, Math.floor((xp - tier.min) / span));
  const floor = Math.round(tier.min + d * span);
  const next = d === 2 ? nextTier.min : Math.round(tier.min + (d + 1) * span);
  const division = DIVISIONS[d]!;
  return {
    tier,
    tierIndex,
    division,
    label: `${tier.name} ${division}`,
    floor,
    next,
    progress: (xp - floor) / (next - floor),
  };
}
