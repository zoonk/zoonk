import { describe, expect, it } from "vitest";
import {
  type SkillAnswer,
  compareWeeks,
  findBiggestTurnaround,
  summarizeWeek,
} from "./weekly-recap";

const MONDAY = new Date("2026-09-28T00:00:00Z");

function day(offset: number) {
  return new Date(MONDAY.getTime() + offset * 86_400_000);
}

describe(summarizeWeek, () => {
  it("counts the week's study days, minutes and questions", () => {
    const week = summarizeWeek({
      days: [
        { correct: 20, date: day(0), incorrect: 5, seconds: 2700 },
        { correct: 0, date: day(1), incorrect: 0, seconds: 0 },
        { correct: 10, date: day(2), incorrect: 2, seconds: 1500 },
        { correct: 99, date: day(-1), incorrect: 0, seconds: 9999 },
      ],
      weekStart: MONDAY,
    });

    expect(week).toStrictEqual({
      averageMinutes: 35,
      daysStudied: [day(0), day(2)],
      minutes: 70,
      questions: 37,
    });
  });
});

describe(compareWeeks, () => {
  it("compares the week only with the learner's own last week", () => {
    const current = {
      averageMinutes: 44,
      daysStudied: [day(0), day(1)],
      minutes: 220,
      questions: 212,
    };

    const previous = { averageMinutes: 30, daysStudied: [day(-7)], minutes: 180, questions: 150 };

    expect(compareWeeks({ current, previous })).toStrictEqual({
      days: 1,
      minutes: 40,
      questions: 62,
    });
  });
});

function answer(skillId: string, offset: number, isCorrect: boolean, minute = 0): SkillAnswer {
  const localDate = day(offset);

  return {
    answeredAt: new Date(localDate.getTime() + minute * 60_000),
    isCorrect,
    localDate,
    skillId,
  };
}

describe(findBiggestTurnaround, () => {
  it("finds the skill that grew the most and the days it was remembered", () => {
    const answers = [
      answer("proportions", 0, false),
      answer("proportions", 0, true, 1),
      answer("proportions", 0, false, 2),
      answer("proportions", 2, true),
      answer("proportions", 5, true),
      answer("proportions", 5, true, 1),
      answer("steady", 0, true),
      answer("steady", 3, true),
    ];

    const turnaround = findBiggestTurnaround({ answers, weekStart: MONDAY });

    expect(turnaround).toMatchObject({
      from: 1 / 3,
      rememberedOn: [day(2), day(5)],
      skillId: "proportions",
      to: 1,
    });

    expect(turnaround?.points.map((point) => point.accuracy)).toStrictEqual([
      1 / 3,
      null,
      1,
      null,
      null,
      1,
      null,
    ]);
  });

  it("tells nothing when no skill grew enough", () => {
    expect(
      findBiggestTurnaround({
        answers: [answer("a", 0, true), answer("a", 1, true)],
        weekStart: MONDAY,
      }),
    ).toBeNull();
  });
});
