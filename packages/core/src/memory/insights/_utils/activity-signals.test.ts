import { describe, expect, it } from "vitest";
import { type RecentActivity, buildActivitySignals } from "./activity-signals";

type ActivityAttempt = RecentActivity["attempts"][number];
type ActivityMistake = RecentActivity["mistakes"][number];

const MONDAY = Date.UTC(2026, 8, 21);
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

const PERCENTAGES = { id: "skill-percentages", name: "Percentages" };
const FRACTIONS = { id: "skill-fractions", name: "Fractions" };

/** One session of answers on a day, one minute apart, right or wrong in order. */
function session({
  day,
  hour,
  id,
  results,
  skillId = PERCENTAGES.id,
}: {
  day: number;
  hour: number;
  id: string;
  results: boolean[];
  skillId?: string;
}): ActivityAttempt[] {
  const start = MONDAY + day * DAY_MS + hour * 60 * MINUTE_MS;

  return results.map((isCorrect, index) => ({
    answeredAt: new Date(start + index * MINUTE_MS),
    hour,
    isCorrect,
    localDate: new Date(MONDAY + day * DAY_MS),
    skillId,
    studySessionId: id,
  }));
}

function activity(fields: Partial<RecentActivity>): RecentActivity {
  return {
    attempts: [],
    dailyMinutes: 30,
    mistakes: [],
    skills: [PERCENTAGES, FRACTIONS],
    studyDays: [],
    windowDays: 7,
    ...fields,
  };
}

describe(buildActivitySignals, () => {
  it("shows when the last questions of sessions go worse than the first", () => {
    const fading = [true, true, true, true, false, false];

    const signals = buildActivitySignals(
      activity({
        attempts: [
          ...session({ day: 0, hour: 20, id: "a", results: fading }),
          ...session({ day: 1, hour: 20, id: "b", results: fading }),
        ],
      }),
    );

    expect(signals.answerCount).toBe(12);
    expect(signals.dayCount).toBe(2);

    expect(signals.text).toContain(
      "By part of the session, over 2 sessions: first third 100% right (4 answers), middle third 100% right (4 answers), last third 0% right (4 answers).",
    );
  });

  it("compares times of day only with enough answers in each", () => {
    const signals = buildActivitySignals(
      activity({
        attempts: [
          ...session({ day: 0, hour: 7, id: "a", results: [true, false, false, false, true] }),
          ...session({ day: 1, hour: 21, id: "b", results: [true, true, true, true, true] }),
          ...session({ day: 2, hour: 13, id: "c", results: [true, true] }),
        ],
      }),
    );

    expect(signals.text).toContain(
      "By time of day: 06:00-12:00 40% right (5 answers on 1 day); 21:00-24:00 100% right (5 answers on 1 day).",
    );
  });

  it("leaves out patterns without enough answers", () => {
    const signals = buildActivitySignals(
      activity({ attempts: session({ day: 0, hour: 9, id: "a", results: [true, false, true] }) }),
    );

    expect(signals.text).toBe("Answers in the last 7 days: 3 on 1 day, 67% right.");
    expect(signals.weakSkills).toStrictEqual([]);
  });

  it("names the weakest skills of the goal with their mistakes and examples", () => {
    const mistakes: ActivityMistake[] = [
      {
        cause: "gap",
        skillId: PERCENTAGES.id,
        snapshot: { answer: "34%", correctAnswer: "75%", question: "What is 3/4 as a percentage?" },
      },
      {
        cause: "trap",
        skillId: PERCENTAGES.id,
        snapshot: { answer: "$100", question: "A price rises 10% then drops 10%. Now?" },
      },
    ];

    const signals = buildActivitySignals(
      activity({
        attempts: [
          ...session({ day: 0, hour: 20, id: "a", results: [false, true, false, true] }),
          ...session({
            day: 1,
            hour: 20,
            id: "b",
            results: [true, true, true, true],
            skillId: FRACTIONS.id,
          }),
          ...session({ day: 1, hour: 21, id: "c", results: [true], skillId: "skill-other-goal" }),
        ],
        mistakes,
      }),
    );

    expect(signals.weakSkills).toStrictEqual([PERCENTAGES]);

    expect(signals.text).toContain(
      [
        "Skills with the most trouble:",
        "- Percentages: 2 of 4 right, 2 mistakes (1 content gap, 1 fell for a trap)",
        "Recent mistakes on Percentages:",
        '- "What is 3/4 as a percentage?": answered "34%", right answer "75%"',
        '- "A price rises 10% then drops 10%. Now?": answered "$100"',
      ].join("\n"),
    );
  });

  it("sums study time per day without counting a session and its lessons twice", () => {
    const signals = buildActivitySignals(
      activity({
        attempts: session({ day: 0, hour: 20, id: "a", results: [true] }),
        studyDays: [
          { localDate: new Date(MONDAY), seconds: 1200 },
          { localDate: new Date(MONDAY + DAY_MS), seconds: 600 },
          { localDate: new Date(MONDAY + 2 * DAY_MS), seconds: 0 },
        ],
      }),
    );

    expect(signals.text).toContain(
      "Studied on 2 of the last 7 days, 15 minutes a day on average; the plan asks for 30.",
    );
  });
});
