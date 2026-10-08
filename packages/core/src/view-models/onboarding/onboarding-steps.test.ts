import { describe, expect, it } from "vitest";
import { getOnboardingSteps } from "./onboarding-steps";

const NEW_PROFILE = { asksMemory: false, hasBirth: false, hasBuddy: false, hasEarlierGoals: false };

const SET_UP_PROFILE = {
  asksMemory: false,
  hasBirth: true,
  hasBuddy: false,
  hasEarlierGoals: true,
};

/** The steps of an exam goal whose words gave these details. */
function examSteps(details: Record<string, unknown>) {
  return getOnboardingSteps({
    goal: { details, kind: "exam", targetDate: null },
    profile: SET_UP_PROFILE,
  });
}

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
      "age",
      "buddy",
      "placement",
      "schedule",
      "plan",
    ]);
  });

  it("asks nothing of the next level of a finished plan: only its plan is ahead", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { continuesFromGoalId: "goal-1", courseLevel: "beginner", level: "basic" },
        kind: "learn",
        targetDate: null,
      },
      profile: NEW_PROFILE,
    });

    expect(steps).toStrictEqual(["plan"]);
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

    expect(steps).toStrictEqual(["placement", "schedule", "plan"]);
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
      goal: {
        details: { examName: "ENEM", examTarget: "admission" },
        kind: "exam",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    const withTarget = getOnboardingSteps({
      goal: {
        details: { examName: "ENEM", examTarget: "admission", targetCourse: "Nursing" },
        kind: "exam",
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(withoutTarget).toStrictEqual(["target", "level", "placement", "schedule", "plan"]);
    expect(withTarget).toStrictEqual(["level", "placement", "schedule", "plan"]);
  });

  it("asks only for the target the exam has: a position for a concurso, nothing for a pass", () => {
    // A concurso that named its position, one that didn't, and the OAB, which is only passed.
    expect(examSteps({ examTarget: "position", targetPosition: "Agente" })).not.toContain("target");
    expect(examSteps({ examTarget: "position", targetScore: "80 pontos" })[0]).toBe("target");
    expect(examSteps({ examName: "OAB" })).not.toContain("target");
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

    // A class test is only passed: no score, course or job to ask about.
    expect(steps.slice(0, 2)).toStrictEqual(["targetDate", "level"]);
  });

  it("asks a language goal why, unless it said so", () => {
    const steps = getOnboardingSteps({
      goal: { details: { level: "basic" }, kind: "language", targetDate: null },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["reason", "targetDate", "placement", "schedule", "plan"]);
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

  it("offers the buddy once, in the first onboarding, to learners without one", () => {
    const answered = { answered: ["purpose", "targetDate", "level", "schedule", "placement"] };
    const goal = { details: answered, kind: "learn" as const, targetDate: null };
    const firstGoal = { ...SET_UP_PROFILE, hasEarlierGoals: false };

    expect(getOnboardingSteps({ goal, profile: firstGoal })).toStrictEqual(["buddy", "plan"]);

    expect(getOnboardingSteps({ goal, profile: { ...firstGoal, hasBuddy: true } })).toStrictEqual([
      "plan",
    ]);

    expect(getOnboardingSteps({ goal, profile: SET_UP_PROFILE })).toStrictEqual(["plan"]);
  });

  it("remembers a buddy answer, picked or skipped", () => {
    expect(
      getOnboardingSteps({
        goal: { details: { answered: ["buddy", "age"] }, kind: "learn", targetDate: null },
        profile: NEW_PROFILE,
      }),
    ).not.toContain("buddy");
  });

  it("asks a course start only for the level and time, then places the learner in the course", () => {
    const steps = getOnboardingSteps({
      goal: { details: { courseStart: { chapterId: null } }, kind: "learn", targetDate: null },
      profile: NEW_PROFILE,
    });

    expect(steps).toStrictEqual(["level", "age", "buddy", "placement", "schedule", "plan"]);
  });

  it("gives a language course its level test, without asking why they learn it", () => {
    const steps = getOnboardingSteps({
      goal: { details: { courseStart: { chapterId: null } }, kind: "language", targetDate: null },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["level", "placement", "schedule", "plan"]);
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
