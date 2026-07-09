/**
 * Family Quest — D&D-lite rules.
 *
 * Four kid-friendly stats, a d20, and no death. That's the whole rulebook.
 */

export const STATS = ["brave", "smart", "charm", "sneaky"] as const;
export type StatName = (typeof STATS)[number];

export type Stats = Record<StatName, number>;

/** Points a player distributes across the four stats at character creation. */
export const STAT_POOL = 8;
/** A single stat can hold at most this many points. */
export const STAT_MAX = 4;
export const STAT_MIN = 0;

/** Every character starts with this many heart points. */
export const MAX_HP = 6;

/** Difficulty bands the DM picks from. */
export const DC = { easy: 5, medium: 10, hard: 15 } as const;
export type Difficulty = keyof typeof DC;

export type RollOutcome = "critSuccess" | "success" | "fail" | "fumble";

export interface RollResult {
  /** The raw face of the d20, 1–20. */
  raw: number;
  /** The stat bonus that was added. */
  bonus: number;
  total: number;
  dc: number;
  outcome: RollOutcome;
}

/** Validate a proposed stat allocation from a player. */
export function isValidAllocation(stats: Stats): boolean {
  const values = STATS.map((s) => stats[s]);
  if (values.some((v) => !Number.isInteger(v) || v < STAT_MIN || v > STAT_MAX)) {
    return false;
  }
  return values.reduce((a, b) => a + b, 0) === STAT_POOL;
}

/** Roll a raw d20 using the provided RNG (defaults to Math.random). */
export function rollD20(rng: () => number = Math.random): number {
  const r = Math.floor(rng() * 20) + 1;
  // Guard against a pathological rng returning exactly 1.0
  return Math.min(Math.max(r, 1), 20);
}

/**
 * Resolve a skill check. Natural 20 always crits, natural 1 always fumbles —
 * kids love the drama of the extremes.
 */
export function resolveCheck(raw: number, bonus: number, dc: number): RollResult {
  const total = raw + bonus;
  let outcome: RollOutcome;
  if (raw === 20) outcome = "critSuccess";
  else if (raw === 1) outcome = "fumble";
  else if (total >= dc) outcome = "success";
  else outcome = "fail";
  return { raw, bonus, total, dc, outcome };
}

/** Clamp an HP change. HP never goes below 0 (knocked out) or above MAX_HP. */
export function applyHpDelta(current: number, delta: number, maxHp: number = MAX_HP): number {
  return Math.min(Math.max(current + delta, 0), maxHp);
}
