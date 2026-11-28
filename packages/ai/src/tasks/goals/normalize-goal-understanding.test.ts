import { describe, expect, it } from "vitest";
import { normalizeGoalUnderstanding } from "./normalize-goal-understanding";
import { type RawGoalUnderstanding } from "./understood-goal";

const DAILY_MINUTES_LIMITS = { max: 1440, min: 5 };

type RawUnderstoodGoal = RawGoalUnderstanding["goals"][number];

const TODAY = "2026-09-26";

function rawGoal(overrides: Partial<RawUnderstoodGoal> = {}): RawUnderstoodGoal {
  return {
    classTest: false,
    contentCountry: null,
    countryDependent: false,
    examDay: null,
    examMonth: null,
    examName: null,
    examNotBooked: false,
    examOption: null,
    examSubjects: null,
    examTarget: null,
    examYear: null,
    followUps: [],
    institution: null,
    kind: "learn",
    level: null,
    nativeLanguage: null,
    ownLevel: null,
    purpose: null,
    reason: null,
    role: null,
    subject: "Quantum physics",
    targetCourse: null,
    targetDate: null,
    targetLanguage: null,
    targetPosition: null,
    targetScore: null,
    title: "Understand quantum physics",
    ...overrides,
  };
}

function raw(overrides: Partial<RawGoalUnderstanding> = {}): RawGoalUnderstanding {
  return {
    dailyMinutes: null,
    goals: [rawGoal()],
    instrument: null,
    question: null,
    route: "goals",
    studyDays: null,
    studyTime: null,
    studyTimeNote: null,
    ...overrides,
  };
}

function readGoals(goals: RawUnderstoodGoal[]) {
  return normalizeGoalUnderstanding({
    dailyMinutesLimits: DAILY_MINUTES_LIMITS,
    raw: raw({ goals }),
    today: TODAY,
  });
}

function readWithIntent(
  materialIntent: "exam" | "understand",
  kind: "exam" | "language" | "learn",
) {
  return normalizeGoalUnderstanding({
    dailyMinutesLimits: DAILY_MINUTES_LIMITS,
    materialIntent,
    raw: raw({
      goals: [rawGoal({ examName: "Unit test", kind, targetLanguage: "es" }), rawGoal()],
    }),
    today: TODAY,
  });
}

describe(normalizeGoalUnderstanding, () => {
  it("trims display names without truncating or replacing an empty name with the summary", () => {
    const longName = "Astronomy ".repeat(30).trim();

    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [rawGoal({ displayName: `  ${longName}  ` }), rawGoal({ displayName: "   " })],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({
      goals: [{ displayName: longName }, { displayName: undefined }],
      route: "goals",
    });
  });

  it("keeps the exam subjects a goal names and drops them from other goals", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({
            examName: "SAT",
            examSubjects: [" math ", "reading", "math", ""],
            kind: "exam",
          }),
          rawGoal({ examName: "SAT", examSubjects: [], kind: "exam" }),
          rawGoal({ examSubjects: ["algebra"] }),
        ],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({
      goals: [
        { examSubjects: ["math", "reading"] },
        { examSubjects: undefined },
        { examSubjects: undefined },
      ],
    });
  });

  it("asks only what the main goal needs, since onboarding asks while setting that goal up", () => {
    const finals = rawGoal({
      followUps: ["  Which subjects do your finals cover?  "],
      kind: "exam",
      subject: "finals",
      title: "Get ready for my finals",
    });

    expect(readGoals([rawGoal(), finals])).toMatchObject({ followUps: [] });

    expect(readGoals([finals, rawGoal()])).toMatchObject({
      followUps: ["Which subjects do your finals cover?"],
    });

    expect(
      readGoals([rawGoal({ followUps: ["Lost with its goal"], title: " " }), finals]),
    ).toMatchObject({
      followUps: ["Which subjects do your finals cover?"],
      goals: [expect.objectContaining({ title: "Get ready for my finals" })],
    });
  });

  it("uses the caller's daily time limits", () => {
    expect(
      normalizeGoalUnderstanding({
        dailyMinutesLimits: { max: 90, min: 10 },
        raw: raw({ dailyMinutes: 2 }),
        today: TODAY,
      }),
    ).toMatchObject({ dailyMinutes: 10 });

    expect(
      normalizeGoalUnderstanding({
        dailyMinutesLimits: { max: 90, min: 10 },
        raw: raw({ dailyMinutes: 200 }),
        today: TODAY,
      }),
    ).toMatchObject({ dailyMinutes: 90 });
  });

  it("keeps what an exam goal said and leaves the rest undefined", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({
            examName: "ENEM",
            examYear: 2026,
            kind: "exam",
            purpose: "deep",
            subject: "ENEM",
            targetCourse: "Nursing",
            title: "Pass the 2026 ENEM",
          }),
        ],
        studyTime: "21:30",
        studyTimeNote: "At night, after school",
      }),
      today: TODAY,
    });

    expect(result).toStrictEqual({
      dailyMinutes: undefined,
      followUps: [],
      goals: [
        expect.objectContaining({
          examName: "ENEM",
          examYear: 2026,
          kind: "exam",
          purpose: undefined,
          targetCourse: "Nursing",
          targetDate: undefined,
          title: "Pass the 2026 ENEM",
        }),
      ],
      route: "goals",
      studyDays: undefined,
      studyTime: "21:30",
      studyTimeNote: "At night, after school",
    });
  });

  it("writes the course an exam's learner aims for with a capital, as a name stands alone", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({
            examName: "ENEM",
            institution: "UFMG",
            kind: "exam",
            targetCourse: " medicina ",
            title: "Passar no ENEM",
          }),
        ],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({ goals: [{ institution: "UFMG", targetCourse: "Medicina" }] });
  });

  it("keeps the month the learner named for an exam, only a real one, and only for exams", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({ examMonth: 3, examName: "OAB", examYear: 2027, kind: "exam" }),
          rawGoal({ examMonth: 13, examName: "ENEM", kind: "exam" }),
          rawGoal({ examMonth: 3 }),
        ],
      }),
      today: TODAY,
    });

    expect(
      result.route === "goals" ? result.goals.map((goal) => goal.examMonth) : null,
    ).toStrictEqual([3, undefined, undefined]);
  });

  it("keeps what an exam's learner aims for beyond passing and how its day is set, only for exams", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({ examDay: "booked", examName: "GMAT", examTarget: "score", kind: "exam" }),
          rawGoal({ examName: "OAB", examTarget: null, kind: "exam" }),
          rawGoal({ examDay: "booked", examTarget: "score" }),
        ],
      }),
      today: TODAY,
    });

    expect(
      result.route === "goals"
        ? result.goals.map(({ examDay, examTarget }) => ({ examDay, examTarget }))
        : null,
    ).toStrictEqual([
      { examDay: "booked", examTarget: "score" },
      { examDay: undefined, examTarget: undefined },
      { examDay: undefined, examTarget: undefined },
    ]);
  });

  it("never names a class test as a public exam, so nothing treats a school term's name as one", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({
            classTest: true,
            examDay: "official",
            examName: "기말고사",
            examSubjects: ["국어", "수학", "영어"],
            examTarget: "score",
            kind: "exam",
            subject: "기말고사",
          }),
          rawGoal({ classTest: false, examDay: "official", examName: "수능", kind: "exam" }),
        ],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({
      goals: [
        {
          classTest: true,
          examDay: undefined,
          examName: undefined,
          examSubjects: ["국어", "수학", "영어"],
          examTarget: undefined,
          subject: "기말고사",
        },
        { classTest: undefined, examDay: "official", examName: "수능" },
      ],
    });
  });

  it("drops past or invalid dates, invalid times and out-of-range weekdays", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [rawGoal({ targetDate: "2026-01-10" }), rawGoal({ targetDate: "2027-13-45" })],
        studyDays: [1, 3, 3, 9, -1],
        studyTime: "25:00",
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({ route: "goals", studyDays: [1, 3], studyTime: undefined });

    expect(result.route === "goals" && result.goals.map((goal) => goal.targetDate)).toStrictEqual([
      undefined,
      undefined,
    ]);
  });

  it("gives the main goal the kind the learner chose for their material", () => {
    expect(readWithIntent("exam", "learn")).toMatchObject({
      goals: [{ examName: "Unit test", kind: "exam" }, { kind: "learn" }],
    });

    expect(readWithIntent("understand", "exam")).toMatchObject({
      goals: [{ examName: undefined, kind: "learn" }, { kind: "learn" }],
    });

    expect(readWithIntent("understand", "language")).toMatchObject({
      goals: [{ kind: "language" }, {}],
    });
  });

  it("keeps daily minutes within what the planner accepts", () => {
    const tooLittle = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({ dailyMinutes: 1 }),
      today: TODAY,
    });

    const tooMuch = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({ dailyMinutes: 2000 }),
      today: TODAY,
    });

    expect(tooLittle).toMatchObject({ dailyMinutes: 5 });
    expect(tooMuch).toMatchObject({ dailyMinutes: 1440 });
  });

  it("drops language goals without a language and keeps at most three goals", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({ kind: "language", targetLanguage: null, title: "Speak better" }),
          rawGoal({
            kind: "language",
            nativeLanguage: "es",
            targetLanguage: "en",
            title: "English",
          }),
          rawGoal({ title: "Two" }),
          rawGoal({ title: "Three" }),
          rawGoal({ title: "Four" }),
        ],
      }),
      today: TODAY,
    });

    expect(result.route === "goals" && result.goals.map((goal) => goal.title)).toStrictEqual([
      "English",
      "Two",
    ]);
  });

  it("stores Mandarin under the same code as Chinese", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [rawGoal({ kind: "language", nativeLanguage: "pt-BR", targetLanguage: "cmn" })],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({ goals: [{ nativeLanguage: "pt", targetLanguage: "zh" }] });
  });

  it("keeps the country a language goal names, and drops one its language doesn't list", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({ kind: "language", targetLanguage: "es-AR", title: "Argentine Spanish" }),
          rawGoal({ kind: "language", targetLanguage: "pt-JP", title: "Portuguese" }),
          rawGoal({ examName: "IELTS", kind: "exam", targetLanguage: "en-GB", title: "IELTS" }),
        ],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({
      goals: [
        { targetLanguage: "es", targetRegion: "AR" },
        { targetLanguage: "pt", targetRegion: undefined },
        { targetLanguage: "en", targetRegion: undefined },
      ],
    });
  });

  it("keeps a learn or exam goal's country only as a real code", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({ contentCountry: " de ", countryDependent: true, title: "Impostos" }),
          rawGoal({ contentCountry: "ZZ", countryDependent: true, title: "Finanças" }),
          rawGoal({
            contentCountry: "ca",
            countryDependent: true,
            examName: "PPL",
            kind: "exam",
            title: "Pilot licence",
          }),
        ],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({
      goals: [
        { contentCountry: "DE", countryDependent: true },
        { contentCountry: undefined, countryDependent: true },
        { contentCountry: "CA", countryDependent: true },
      ],
    });
  });

  it("drops the country named with an exam that is the same everywhere", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({
            contentCountry: "KE",
            countryDependent: false,
            examName: "SAT",
            kind: "exam",
            title: "SAT",
          }),
        ],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({
      goals: [{ contentCountry: undefined, countryDependent: false }],
    });
  });

  it("never gives a language a country or marks it as waiting for one", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({
            contentCountry: "US",
            countryDependent: true,
            kind: "language",
            targetLanguage: "en",
            title: "En",
          }),
        ],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({
      goals: [{ contentCountry: undefined, countryDependent: false }],
    });
  });

  it("keeps an exam's stated option and not-booked reading only on exam goals", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({
            examDay: "booked",
            examName: "FE",
            examNotBooked: true,
            examOption: " Mechanical ",
            kind: "exam",
            title: "FE",
          }),
          rawGoal({ examNotBooked: true, examOption: "Mechanical", title: "Mechanics" }),
        ],
      }),
      today: TODAY,
    });

    expect(result).toMatchObject({
      goals: [
        { examNotBooked: true, examOption: "Mechanical" },
        { examNotBooked: undefined, examOption: undefined },
      ],
    });
  });

  it("reads a booked exam with a date, or an official one, as not waiting for a booking", () => {
    const result = normalizeGoalUnderstanding({
      dailyMinutesLimits: DAILY_MINUTES_LIMITS,
      raw: raw({
        goals: [
          rawGoal({
            examDay: "booked",
            examName: "IELTS",
            examNotBooked: true,
            kind: "exam",
            targetDate: "2026-12-01",
            title: "IELTS",
          }),
          rawGoal({
            examDay: "official",
            examName: "ENEM",
            examNotBooked: true,
            kind: "exam",
            title: "ENEM",
          }),
        ],
      }),
      today: TODAY,
    });

    expect(
      result.route === "goals" && result.goals.map((goal) => goal.examNotBooked),
    ).toStrictEqual([undefined, undefined]);
  });

  it("asks for more when nothing usable is left", () => {
    expect(
      normalizeGoalUnderstanding({
        dailyMinutesLimits: DAILY_MINUTES_LIMITS,
        raw: raw({ goals: [rawGoal({ title: "  " })] }),
        today: TODAY,
      }),
    ).toStrictEqual({ route: "unclear" });

    expect(
      normalizeGoalUnderstanding({
        dailyMinutesLimits: DAILY_MINUTES_LIMITS,
        raw: raw({ question: null, route: "explain" }),
        today: TODAY,
      }),
    ).toStrictEqual({ route: "unclear" });
  });

  it("returns only what each other route needs", () => {
    expect(
      normalizeGoalUnderstanding({
        dailyMinutesLimits: DAILY_MINUTES_LIMITS,
        raw: raw({ question: "How a microwave works", route: "explain" }),
        today: TODAY,
      }),
    ).toStrictEqual({ question: "How a microwave works", route: "explain" });

    expect(
      normalizeGoalUnderstanding({
        dailyMinutesLimits: DAILY_MINUTES_LIMITS,
        raw: raw({ instrument: "guitar", route: "instrument" }),
        today: TODAY,
      }),
    ).toStrictEqual({ instrument: "guitar", route: "instrument" });

    expect(
      normalizeGoalUnderstanding({
        dailyMinutesLimits: DAILY_MINUTES_LIMITS,
        raw: raw({ route: "unsafe" }),
        today: TODAY,
      }),
    ).toStrictEqual({ route: "unsafe" });
  });
});
