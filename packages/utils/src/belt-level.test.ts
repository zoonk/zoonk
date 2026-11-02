import { describe, expect, it } from "vitest";
import {
  BELT_COLORS_ORDER,
  calculateBeltLevel,
  getBeltStartBrainPower,
  getNextBelt,
} from "./belt-level";

describe(calculateBeltLevel, () => {
  describe("white belt (250 BP per level)", () => {
    it("0 BP returns White 1 with 250 BP to next", () => {
      const result = calculateBeltLevel(0);

      expect(result).toStrictEqual({
        bpPerLevel: 250,
        bpToNextLevel: 250,
        color: "white",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    it("249 BP returns White 1 with 1 BP to next", () => {
      const result = calculateBeltLevel(249);

      expect(result).toStrictEqual({
        bpPerLevel: 250,
        bpToNextLevel: 1,
        color: "white",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 249,
      });
    });

    it("250 BP returns White 2 with 250 BP to next", () => {
      const result = calculateBeltLevel(250);

      expect(result).toStrictEqual({
        bpPerLevel: 250,
        bpToNextLevel: 250,
        color: "white",
        isMaxLevel: false,
        level: 2,
        progressInLevel: 0,
      });
    });

    it("2250 BP returns White 10 with 250 BP to next", () => {
      const result = calculateBeltLevel(2250);

      expect(result).toStrictEqual({
        bpPerLevel: 250,
        bpToNextLevel: 250,
        color: "white",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 0,
      });
    });

    it("2499 BP returns White 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(2499);

      expect(result).toStrictEqual({
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
    it("2500 BP returns Yellow 1 with 500 BP to next", () => {
      const result = calculateBeltLevel(2500);

      expect(result).toStrictEqual({
        bpPerLevel: 500,
        bpToNextLevel: 500,
        color: "yellow",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    it("7000 BP returns Yellow 10 with 500 BP to next", () => {
      const result = calculateBeltLevel(7000);

      expect(result).toStrictEqual({
        bpPerLevel: 500,
        bpToNextLevel: 500,
        color: "yellow",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 0,
      });
    });

    it("7499 BP returns Yellow 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(7499);

      expect(result).toStrictEqual({
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
    it("7500 BP returns Orange 1 with 1000 BP to next", () => {
      const result = calculateBeltLevel(7500);

      expect(result).toStrictEqual({
        bpPerLevel: 1000,
        bpToNextLevel: 1000,
        color: "orange",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    it("15000 BP returns Orange 8 with 500 BP to next (E2E test user)", () => {
      const result = calculateBeltLevel(15_000);

      expect(result).toStrictEqual({
        bpPerLevel: 1000,
        bpToNextLevel: 500,
        color: "orange",
        isMaxLevel: false,
        level: 8,
        progressInLevel: 500,
      });
    });

    it("17499 BP returns Orange 10 with 1 BP to next", () => {
      const result = calculateBeltLevel(17_499);

      expect(result).toStrictEqual({
        bpPerLevel: 1000,
        bpToNextLevel: 1,
        color: "orange",
        isMaxLevel: false,
        level: 10,
        progressInLevel: 999,
      });
    });
  });

  describe("black belt (100000 BP per level)", () => {
    it("2167500 BP returns Black 1 with 100000 BP to next", () => {
      const result = calculateBeltLevel(2_167_500);

      expect(result).toStrictEqual({
        bpPerLevel: 100_000,
        bpToNextLevel: 100_000,
        color: "black",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });

    it("3067500 BP returns Black 10 at max level", () => {
      const result = calculateBeltLevel(3_067_500);

      expect(result).toStrictEqual({
        bpPerLevel: 100_000,
        bpToNextLevel: 0,
        color: "black",
        isMaxLevel: true,
        level: 10,
        progressInLevel: 0,
      });
    });

    it("beyond max level still returns Black 10", () => {
      const result = calculateBeltLevel(5_000_000);

      expect(result).toStrictEqual({
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
    it("negative BP is treated as 0", () => {
      const result = calculateBeltLevel(-100);

      expect(result).toStrictEqual({
        bpPerLevel: 250,
        bpToNextLevel: 250,
        color: "white",
        isMaxLevel: false,
        level: 1,
        progressInLevel: 0,
      });
    });
  });

  it.each(
    BELT_COLORS_ORDER.slice(1).map((color, index) => ({
      color,
      previous: BELT_COLORS_ORDER[index],
    })),
  )("starts $color level 1 right after $previous level 10 ends", ({ color, previous }) => {
    const start = getBeltStartBrainPower(color);

    expect(calculateBeltLevel(start - 1)).toMatchObject({
      bpToNextLevel: 1,
      color: previous,
      level: 10,
    });

    expect(calculateBeltLevel(start)).toMatchObject({ color, level: 1, progressInLevel: 0 });
  });
});

describe(getBeltStartBrainPower, () => {
  it("returns where each belt color starts", () => {
    expect(getBeltStartBrainPower("white")).toBe(0);
    expect(getBeltStartBrainPower("orange")).toBe(7500);

    expect(calculateBeltLevel(getBeltStartBrainPower("green"))).toMatchObject({
      color: "green",
      level: 1,
    });
  });
});

describe(getNextBelt, () => {
  it("names the next belt, where it starts and how far that is", () => {
    expect(getNextBelt(50)).toStrictEqual({
      brainPowerToGo: 2450,
      color: "yellow",
      startBrainPower: 2500,
    });

    expect(getNextBelt(15_000)).toStrictEqual({
      brainPowerToGo: 2500,
      color: "green",
      startBrainPower: 17_500,
    });
  });

  it("moves on to the belt after once a belt starts", () => {
    expect(getNextBelt(getBeltStartBrainPower("green"))).toMatchObject({
      color: "blue",
      startBrainPower: getBeltStartBrainPower("blue"),
    });
  });

  it("has no next belt once the learner is on Black", () => {
    expect(getNextBelt(getBeltStartBrainPower("black") - 1)).toMatchObject({
      brainPowerToGo: 1,
      color: "black",
    });

    expect(getNextBelt(getBeltStartBrainPower("black"))).toBeNull();
    expect(getNextBelt(5_000_000)).toBeNull();
  });
});
