import { describe, expect, it } from "vitest";
import { getExamScale, isOnExamScale, percentToExamScale, roundToExamScale } from "./exam-scales";

function scaleOf({ key = "exam", name = "", title = "" }) {
  return getExamScale({ blueprint: { identityKey: key, name }, goal: { title } });
}

describe(getExamScale, () => {
  it("tells SAT, AP and TOEFL iBT apart from their names", () => {
    expect(scaleOf({ key: "sat", name: "SAT" })).toBe("sat");
    expect(scaleOf({ name: "AP Biology Exam" })).toBe("ap");
    expect(scaleOf({ key: "ap-calculus-ab", name: "Calculus AB" })).toBe("ap");
    expect(scaleOf({ name: "Advanced Placement Chemistry" })).toBe("ap");
    expect(scaleOf({ name: "TOEFL iBT" })).toBe("toefl");
    expect(scaleOf({ title: "Get 5.5 on the TOEFL" })).toBe("toefl");
  });

  it("leaves other exams and other TOEFL tests on their own scales", () => {
    expect(scaleOf({ key: "enem", name: "ENEM" })).toBeNull();
    expect(scaleOf({ name: "Concurso TJ-AP 2026" })).toBeNull();
    expect(scaleOf({ name: "TOEFL ITP" })).toBeNull();
    expect(scaleOf({ name: "TOEFL Essentials" })).toBeNull();
    expect(scaleOf({ name: "TOEFL Junior" })).toBeNull();
    expect(getExamScale({ blueprint: null, goal: null })).toBeNull();
  });
});

describe(percentToExamScale, () => {
  it("puts SAT estimates on 400 to 1600 in steps of 10", () => {
    expect(percentToExamScale({ range: { high: 72, low: 61 }, scale: "sat" })).toStrictEqual({
      high: 1260,
      low: 1130,
    });

    expect(percentToExamScale({ range: { high: 100, low: 0 }, scale: "sat" })).toStrictEqual({
      high: 1600,
      low: 400,
    });
  });

  it("puts TOEFL estimates on the 1 to 6 band in half bands", () => {
    expect(percentToExamScale({ range: { high: 83, low: 64 }, scale: "toefl" })).toStrictEqual({
      high: 5,
      low: 4,
    });
  });

  it("turns an AP composite into scores from 1 to 5", () => {
    expect(percentToExamScale({ range: { high: 58, low: 44 }, scale: "ap" })).toStrictEqual({
      high: 4,
      low: 3,
    });

    expect(percentToExamScale({ range: { high: 20, low: 5 }, scale: "ap" })).toStrictEqual({
      high: 1,
      low: 1,
    });

    expect(percentToExamScale({ range: { high: 95, low: 80 }, scale: "ap" })).toStrictEqual({
      high: 5,
      low: 5,
    });
  });
});

describe(roundToExamScale, () => {
  it("rounds to the step and stays within the scale", () => {
    expect(roundToExamScale({ scale: "sat", value: 1234 })).toBe(1230);
    expect(roundToExamScale({ scale: "sat", value: 1700 })).toBe(1600);
    expect(roundToExamScale({ scale: "toefl", value: 4.3 })).toBe(4.5);
    expect(roundToExamScale({ scale: "ap", value: 0.2 })).toBe(1);
  });
});

describe(isOnExamScale, () => {
  it("accepts only scores the exam can report", () => {
    expect(isOnExamScale({ scale: "sat", score: 1350 })).toBe(true);
    expect(isOnExamScale({ scale: "sat", score: 1355 })).toBe(false);
    expect(isOnExamScale({ scale: "sat", score: 300 })).toBe(false);
    expect(isOnExamScale({ scale: "ap", score: 4 })).toBe(true);
    expect(isOnExamScale({ scale: "ap", score: 4.5 })).toBe(false);
    expect(isOnExamScale({ scale: "toefl", score: 4.5 })).toBe(true);
    expect(isOnExamScale({ scale: "toefl", score: 95 })).toBe(false);
  });
});
