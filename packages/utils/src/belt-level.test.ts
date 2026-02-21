import { describe, expect, test } from "vitest";
import { calculateBeltLevel, getBeltProgressPercent } from "./belt-level";

describe(calculateBeltLevel, () => {
  describe("white belt (250 BP per level)", () => {
    test("0 BP returns White 1 with 250 BP to next", () => {
      const result = calculateBeltLevel(0);
      expect(result).toEqual({
        bpPerLevel: 250,
        bpToNextLevel: 250,
        color: "white",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("249 BP returns White 1 with 1 BP to next", () => {
      const result = calculateBeltLevel(249);
      expect(result).toEqual({
        bpPerLevel: 250,
        bpToNextLevel: 1,
        color: "white",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 249,
      });
    });

    test("250 BP returns White 2 with 250 BP to next", () => {
      const result = calculateBeltLevel(250);
      expect(result).toEqual({
        bpPerLevel: 250,
        bpToNextLevel: 250,
        color: "white",
        isMaxLevel: false,
        level: 2,
        progressInLevel: 0,
      });
    });

    test("2250 BP returns White 10 with 250 BP to next", () => {
      const result = calculateBeltLevel(2250);
      expect(result).toEqual({
        bpPerLevel: 250,
        bpToNextLevel: 250,
        color: "white",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 0,
      });
    });

    test("2499 BP returns White 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(2499);
      expect(result).toEqual({
        bpPerLevel: 250,
        bpToNextLevel: 1,
        color: "white",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 249,
      });
    });
  });

  describe("yellow belt (500 BP per level)", () => {
    test("2500 BP returns Yellow 1 with 500 BP to next", () => {
      const result = calculateBeltLevel(2500);
      expect(result).toEqual({
        bpPerLevel: 500,
        bpToNextLevel: 500,
        color: "yellow",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("7000 BP returns Yellow 10 with 500 BP to next", () => {
      const result = calculateBeltLevel(7000);
      expect(result).toEqual({
        bpPerLevel: 500,
        bpToNextLevel: 500,
        color: "yellow",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 0,
      });
    });

    test("7499 BP returns Yellow 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(7499);
      expect(result).toEqual({
        bpPerLevel: 500,
        bpToNextLevel: 1,
        color: "yellow",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 499,
      });
    });
  });

  describe("orange belt (1000 BP per level)", () => {
    test("7500 BP returns Orange 1 with 1000 BP to next", () => {
      const result = calculateBeltLevel(7500);
      expect(result).toEqual({
        bpPerLevel: 1000,
        bpToNextLevel: 1000,
        color: "orange",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("15000 BP returns Orange 8 with 500 BP to next (E2E test user)", () => {
      const result = calculateBeltLevel(15_000);
      expect(result).toEqual({
        bpPerLevel: 1000,
        bpToNextLevel: 500,
        color: "orange",
        isMaxLevel: false,
        level: 8,
        progressInLevel: 500,
      });
    });

    test("17499 BP returns Orange 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(17_499);
      expect(result).toEqual({
        bpPerLevel: 1000,
        bpToNextLevel: 1,
        color: "orange",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 999,
      });
    });
  });

  describe("green belt (5000 BP per level)", () => {
    test("17500 BP returns Green 1 with 5000 BP to next", () => {
      const result = calculateBeltLevel(17_500);
      expect(result).toEqual({
        bpPerLevel: 5000,
        bpToNextLevel: 5000,
        color: "green",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("67499 BP returns Green 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(67_499);
      expect(result).toEqual({
        bpPerLevel: 5000,
        bpToNextLevel: 1,
        color: "green",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 4999,
      });
    });
  });

  describe("blue belt (10000 BP per level)", () => {
    test("67500 BP returns Blue 1 with 10000 BP to next", () => {
      const result = calculateBeltLevel(67_500);
      expect(result).toEqual({
        bpPerLevel: 10_000,
        bpToNextLevel: 10_000,
        color: "blue",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("167499 BP returns Blue 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(167_499);
      expect(result).toEqual({
        bpPerLevel: 10_000,
        bpToNextLevel: 1,
        color: "blue",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 9999,
      });
    });
  });

  describe("purple belt (20000 BP per level)", () => {
    test("167500 BP returns Purple 1 with 20000 BP to next", () => {
      const result = calculateBeltLevel(167_500);
      expect(result).toEqual({
        bpPerLevel: 20_000,
        bpToNextLevel: 20_000,
        color: "purple",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("367499 BP returns Purple 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(367_499);
      expect(result).toEqual({
        bpPerLevel: 20_000,
        bpToNextLevel: 1,
        color: "purple",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 19_999,
      });
    });
  });

  describe("brown belt (40000 BP per level)", () => {
    test("367500 BP returns Brown 1 with 40000 BP to next", () => {
      const result = calculateBeltLevel(367_500);
      expect(result).toEqual({
        bpPerLevel: 40_000,
        bpToNextLevel: 40_000,
        color: "brown",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("767499 BP returns Brown 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(767_499);
      expect(result).toEqual({
        bpPerLevel: 40_000,
        bpToNextLevel: 1,
        color: "brown",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 39_999,
      });
    });
  });

  describe("red belt (60000 BP per level)", () => {
    test("767500 BP returns Red 1 with 60000 BP to next", () => {
      const result = calculateBeltLevel(767_500);
      expect(result).toEqual({
        bpPerLevel: 60_000,
        bpToNextLevel: 60_000,
        color: "red",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("1367499 BP returns Red 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(1_367_499);
      expect(result).toEqual({
        bpPerLevel: 60_000,
        bpToNextLevel: 1,
        color: "red",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 59_999,
      });
    });
  });

  describe("gray belt (80000 BP per level)", () => {
    test("1367500 BP returns Gray 1 with 80000 BP to next", () => {
      const result = calculateBeltLevel(1_367_500);
      expect(result).toEqual({
        bpPerLevel: 80_000,
        bpToNextLevel: 80_000,
        color: "gray",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("2167499 BP returns Gray 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(2_167_499);
      expect(result).toEqual({
        bpPerLevel: 80_000,
        bpToNextLevel: 1,
        color: "gray",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 79_999,
      });
    });
  });

  describe("black belt (100000 BP per level)", () => {
    test("2167500 BP returns Black 1 with 100000 BP to next", () => {
      const result = calculateBeltLevel(2_167_500);
      expect(result).toEqual({
        bpPerLevel: 100_000,
        bpToNextLevel: 100_000,
        color: "black",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    test("3067500 BP returns Black 10 at max level", () => {
      const result = calculateBeltLevel(3_067_500);
      expect(result).toEqual({
        bpPerLevel: 100_000,
        bpToNextLevel: 0,
        color: "black",
        isMaxLevel: true,
        level: 10,
        progressInLevel: 0,
      });
    });

    test("beyond max level still returns Black 10", () => {
      const result = calculateBeltLevel(5_000_000);
      expect(result).toEqual({
        bpPerLevel: 100_000,
        bpToNextLevel: 0,
        color: "black",
        isMaxLevel: true,
        level: 10,
        progressInLevel: 0,
      });
    });
  });

  describe("edge cases", () => {
    test("negative BP is treated as 0", () => {
      const result = calculateBeltLevel(-100);
      expect(result).toEqual({
        bpPerLevel: 250,
        bpToNextLevel: 250,
        color: "white",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });
  });

  describe("progress percentage at boundaries", () => {
    test("0% progress at start of level", () => {
      const result = calculateBeltLevel(0);
      expect(result.progressInLevel).toBe(0);
      expect(getBeltProgressPercent(result)).toBe(0);
    });

    test("50% progress at mid-level", () => {
      const result = calculateBeltLevel(125);
      expect(result.progressInLevel).toBe(125);
      expect(getBeltProgressPercent(result)).toBe(50);
    });

    test("99% progress just before level-up", () => {
      const result = calculateBeltLevel(248);
      expect(result.progressInLevel).toBe(248);
      expect(getBeltProgressPercent(result)).toBe(99);
    });
  });
});

describe(getBeltProgressPercent, () => {
  test("returns 0 for start of level", () => {
    const result = calculateBeltLevel(250);
    expect(getBeltProgressPercent(result)).toBe(0);
  });

  test("returns 50 for mid-level", () => {
    const result = calculateBeltLevel(375);
    expect(getBeltProgressPercent(result)).toBe(50);
  });

  test("returns 100 for near-boundary (rounds up)", () => {
    const result = calculateBeltLevel(249);
    expect(getBeltProgressPercent(result)).toBe(100);
  });

  test("returns 0 for max level", () => {
    const result = calculateBeltLevel(5_000_000);
    expect(getBeltProgressPercent(result)).toBe(0);
  });
});
