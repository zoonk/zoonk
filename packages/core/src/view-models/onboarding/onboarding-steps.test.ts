import { describe, expect, it } from "vitest";
import { getOnboardingSteps } from "./onboarding-steps";

const NEW_PROFILE = {
  experienceMode: null,
  hasBirth: false,
  hasBuddy: false,
  hasEarlierGoals: false,
};

const SET_UP_PROFILE = {
  experienceMode: "focus" as const,
  hasBirth: true,
  hasBuddy: false,
  hasEarlierGoals: true,
};

describe(getOnboardingSteps, () => {
  it("asks a learn goal what it's for, how much they know and their time", () => {
    const steps = getOnboardingSteps({
      goal: { details: { subject: "Quantum physics" }, kind: "learn", targetDate: null },
      profile: NEW_PROFILE,
    });

    expect(steps).toStrictEqual([
      "purpose",
      "targetDate",
      "level",
      "schedule",
      "age",
      "mode",
      "buddy",
      "placement",
      "plan",
    ]);
  });

  it("skips what the typed goal already said", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { level: "basic", purpose: "work", role: "Marketing analyst" },
        kind: "learn",
        targetDate: "2027-01-31",
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["schedule", "placement", "plan"]);
  });

  it("asks for the role only when the goal is for work", () => {
    const steps = getOnboardingSteps({
      goal: { details: { purpose: "work" }, kind: "learn", targetDate: null },
      profile: SET_UP_PROFILE,
    });

    expect(steps.slice(0, 2)).toStrictEqual(["role", "targetDate"]);
  });

  it("asks a career change for the role they want, even when the words gave their current one", () => {
    const asks = getOnboardingSteps({
      goal: {
        details: { purpose: "careerChange", role: "Teacher" },
        kind: "learn",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    const knows = getOnboardingSteps({
      goal: {
        details: { purpose: "careerChange", targetPosition: "UX designer" },
        kind: "learn",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(asks[0]).toBe("role");
    expect(knows).not.toContain("role");
  });

  it("asks an exam for its target but never for a date, which comes from the notice", () => {
    const withoutTarget = getOnboardingSteps({
      goal: { details: { examName: "ENEM" }, kind: "exam", targetDate: null },
      profile: SET_UP_PROFILE,
    });

    const withTarget = getOnboardingSteps({
      goal: {
        details: { examName: "ENEM", targetCourse: "Nursing" },
        kind: "exam",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(withoutTarget).toStrictEqual(["target", "level", "schedule", "placement", "plan"]);
    expect(withTarget).toStrictEqual(["level", "schedule", "placement", "plan"]);
  });

  it("asks a class test from the learner's own material for its date, which no notice gives", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { examName: "Biology test", materialIntent: "exam" },
        kind: "exam",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps.slice(0, 2)).toStrictEqual(["target", "targetDate"]);
  });

  it("asks a language goal why, unless it said so", () => {
    const steps = getOnboardingSteps({
      goal: { details: { level: "basic" }, kind: "language", targetDate: null },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["reason", "targetDate", "schedule", "placement", "plan"]);
  });

  it("keeps skipped and answered questions behind the learner", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { answered: ["purpose", "targetDate", "level", "schedule", "placement"] },
        kind: "learn",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["plan"]);
  });

  it("asks the AI's follow-ups for unusual goals", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: {
          followUps: [{ answer: null, question: "Which instrument does the band need?" }],
        },
        kind: "learn",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toContain("followUps");
  });

  it("skips placement for someone starting from nothing", () => {
    const steps = getOnboardingSteps({
      goal: { details: { level: "none", purpose: "overview" }, kind: "learn", targetDate: null },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["targetDate", "schedule", "plan"]);
  });

  it("offers the buddy only to Fun learners without one, or while Fun can still be chosen", () => {
    const answered = { answered: ["purpose", "targetDate", "level", "schedule", "placement"] };
    const goal = { details: answered, kind: "learn" as const, targetDate: null };

    expect(
      getOnboardingSteps({ goal, profile: { ...SET_UP_PROFILE, experienceMode: "fun" } }),
    ).toStrictEqual(["buddy", "plan"]);

    expect(
      getOnboardingSteps({
        goal,
        profile: { ...SET_UP_PROFILE, experienceMode: "fun", hasBuddy: true },
      }),
    ).toStrictEqual(["plan"]);
  });

  it("asks for the mode only once, in the first onboarding, and remembers an answer", () => {
    const goal = { details: { answered: ["mode"] }, kind: "learn" as const, targetDate: null };

    const chosenFun = { ...NEW_PROFILE, experienceMode: "fun" as const };

    expect(getOnboardingSteps({ goal, profile: chosenFun })).not.toContain("mode");
    expect(getOnboardingSteps({ goal, profile: chosenFun })).toContain("buddy");

    expect(
      getOnboardingSteps({ goal, profile: { ...NEW_PROFILE, experienceMode: "focus" } }),
    ).not.toContain("buddy");

    expect(
      getOnboardingSteps({
        goal: { details: { answered: ["mode", "buddy", "age"] }, kind: "learn", targetDate: null },
        profile: NEW_PROFILE,
      }),
    ).not.toContain("buddy");
  });

  it("asks a course start only for the level and time, then places the learner in the course", () => {
    const steps = getOnboardingSteps({
      goal: { details: { courseStart: { chapterId: null } }, kind: "learn", targetDate: null },
      profile: NEW_PROFILE,
    });

    expect(steps).toStrictEqual(["level", "schedule", "age", "mode", "buddy", "placement", "plan"]);
  });

  it("gives a language course its level test, without asking why they learn it", () => {
    const steps = getOnboardingSteps({
      goal: { details: { courseStart: { chapterId: null } }, kind: "language", targetDate: null },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["level", "schedule", "placement", "plan"]);
  });

  it("asks a chapter start only for the learner's time: they chose where to begin", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { courseStart: { chapterId: "0190c9e2-8f1a-7000-8000-000000000001" } },
        kind: "learn",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["schedule", "plan"]);
  });

  it("skips placement for a course start from scratch, like any goal", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: {
          answered: ["level", "schedule"],
          courseStart: { chapterId: null },
          level: "none",
        },
        kind: "learn",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["plan"]);
  });

  it("has no screens for a quick explanation", () => {
    expect(
      getOnboardingSteps({
        goal: { details: {}, kind: "explain", targetDate: null },
        profile: NEW_PROFILE,
      }),
    ).toStrictEqual([]);
  });
});
