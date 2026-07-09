import { describe, expect, it } from "vitest";
import {
  applyHpDelta,
  isValidAllocation,
  MAX_HP,
  resolveCheck,
  rollD20,
  STAT_POOL,
} from "../src/rules.js";

describe("isValidAllocation", () => {
  it("accepts a spread summing to the pool", () => {
    expect(isValidAllocation({ brave: 3, smart: 2, charm: 2, sneaky: 1 })).toBe(true);
  });

  it("rejects totals above or below the pool", () => {
    expect(isValidAllocation({ brave: 4, smart: 4, charm: 4, sneaky: 4 })).toBe(false);
    expect(isValidAllocation({ brave: 1, smart: 1, charm: 1, sneaky: 1 })).toBe(false);
  });

  it("rejects per-stat overflow, negatives, and non-integers", () => {
    expect(isValidAllocation({ brave: 5, smart: 1, charm: 1, sneaky: 1 })).toBe(false);
    expect(isValidAllocation({ brave: -1, smart: 4, charm: 4, sneaky: 1 })).toBe(false);
    expect(isValidAllocation({ brave: 2.5, smart: 2.5, charm: 2, sneaky: 1 })).toBe(false);
  });

  it("pool constant matches the design (8 points)", () => {
    expect(STAT_POOL).toBe(8);
  });
});

describe("rollD20", () => {
  it("spans 1..20 inclusive", () => {
    expect(rollD20(() => 0)).toBe(1);
    expect(rollD20(() => 0.9999)).toBe(20);
  });

  it("never escapes the range even with a broken rng", () => {
    expect(rollD20(() => 1)).toBe(20);
    expect(rollD20(() => -0.5)).toBe(1);
  });
});

describe("resolveCheck", () => {
  it("natural 20 always crits, even against an impossible DC", () => {
    expect(resolveCheck(20, 0, 99).outcome).toBe("critSuccess");
  });

  it("natural 1 always fumbles, even with a huge bonus", () => {
    expect(resolveCheck(1, 10, 5).outcome).toBe("fumble");
  });

  it("meets-it-beats-it on the DC", () => {
    expect(resolveCheck(8, 2, 10).outcome).toBe("success");
    expect(resolveCheck(7, 2, 10).outcome).toBe("fail");
  });

  it("reports the math for the UI", () => {
    const r = resolveCheck(11, 3, 10);
    expect(r).toMatchObject({ raw: 11, bonus: 3, total: 14, dc: 10 });
  });
});

describe("applyHpDelta", () => {
  it("clamps to 0 (knocked out, never dead)", () => {
    expect(applyHpDelta(2, -5)).toBe(0);
  });

  it("clamps to max hp", () => {
    expect(applyHpDelta(5, 3)).toBe(MAX_HP);
  });

  it("applies ordinary deltas", () => {
    expect(applyHpDelta(4, -1)).toBe(3);
    expect(applyHpDelta(3, 2)).toBe(5);
  });
});
