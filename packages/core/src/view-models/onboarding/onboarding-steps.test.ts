import { describe, expect, it } from "vitest";
import { getOnboardingSteps, isGoalSetupLeft } from "./onboarding-steps";

const NEW_PROFILE = { hasBuddy: false, hasEarlierGoals: false };

const SET_UP_PROFILE = { hasBuddy: false, hasEarlierGoals: true };

function examSteps(details: Record<string, unknown>) {
  return getOnboardingSteps({
    goal: { details, kind: "exam", replacesGoalId: null, targetDate: null },
    profile: SET_UP_PROFILE,
  });
}

describe(getOnboardingSteps, () => {
  it("asks a learn goal what it's for, how much they know and their time", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { subject: "Quantum physics" },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: NEW_PROFILE,
    });

    expect(steps).toStrictEqual([
      "purpose",
      "targetDate",
      "level",
      "buddy",
      "placement",
      "schedule",
      "plan",
    ]);
  });

  it("asks nothing of the next level of a finished plan: only its plan is ahead", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { courseLevel: "beginner", level: "basic" },
        kind: "learn",
        replacesGoalId: "goal-1",
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
        replacesGoalId: null,
        targetDate: "2027-01-31",
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["placement", "schedule", "plan"]);
  });

  it("asks for the role only when the goal is for work", () => {
    const steps = getOnboardingSteps({
      goal: { details: { purpose: "work" }, kind: "learn", replacesGoalId: null, targetDate: null },
      profile: SET_UP_PROFILE,
    });

    expect(steps.slice(0, 2)).toStrictEqual(["role", "targetDate"]);
  });

  it("asks a career change for the role they want, even when the words gave their current one", () => {
    const asks = getOnboardingSteps({
      goal: {
        details: { purpose: "careerChange", role: "Teacher" },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    const knows = getOnboardingSteps({
      goal: {
        details: { purpose: "careerChange", targetPosition: "UX designer" },
        kind: "learn",
        replacesGoalId: null,
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
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    const withTarget = getOnboardingSteps({
      goal: {
        details: { examName: "ENEM", examTarget: "admission", targetCourse: "Nursing" },
        kind: "exam",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(withoutTarget).toStrictEqual(["target", "level", "placement", "schedule", "plan"]);
    expect(withTarget).toStrictEqual(["level", "placement", "schedule", "plan"]);
  });

  it("keeps a typed exam's populated notice date without asking for it", () => {
    expect(
      getOnboardingSteps({
        goal: {
          details: { level: "none" },
          kind: "exam",
          replacesGoalId: null,
          targetDate: "2027-01-31",
        },
        profile: SET_UP_PROFILE,
      }),
    ).toStrictEqual(["schedule", "plan"]);
  });

  it.each(["passed", "today"] as const)(
    "asks for a new date when the goal's is %s, even after the learner answered it",
    (dateProblem) => {
      expect(
        getOnboardingSteps({
          goal: {
            dateProblem,
            details: { answered: ["purpose", "targetDate", "level", "schedule", "placement"] },
            kind: "learn",
            replacesGoalId: null,
            targetDate: "2020-10-01",
          },
          profile: SET_UP_PROFILE,
        }),
      ).toStrictEqual(["targetDate", "plan"]);
    },
  );

  it("asks an exam for its date when no sitting falls in the month it understood, until the learner answers", () => {
    const goal = {
      dateProblem: "noSitting" as const,
      details: { level: "none" },
      kind: "exam" as const,
      replacesGoalId: null,
      targetDate: "2027-02-15",
    };

    expect(getOnboardingSteps({ goal, profile: SET_UP_PROFILE })).toStrictEqual([
      "targetDate",
      "schedule",
      "plan",
    ]);

    expect(
      getOnboardingSteps({
        goal: { ...goal, details: { answered: ["targetDate"], level: "none" } },
        profile: SET_UP_PROFILE,
      }),
    ).toStrictEqual(["schedule", "plan"]);
  });

  it("asks only for the target the exam has: a position for a civil service exam, nothing for a pass", () => {
    expect(examSteps({ examTarget: "position", targetPosition: "Agente" })).not.toContain("target");
    expect(examSteps({ examTarget: "position", targetScore: "80 pontos" })[0]).toBe("target");
    expect(examSteps({ examName: "OAB" })).not.toContain("target");
  });

  it("asks a class test from the learner's own material for its date, which no notice gives", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { examName: "Biology test", materialIntent: "exam" },
        kind: "exam",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps.slice(0, 2)).toStrictEqual(["targetDate", "level"]);
  });

  it("asks a language goal why, unless it said so", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { level: "basic" },
        kind: "language",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["reason", "targetDate", "placement", "schedule", "plan"]);
  });

  it("keeps skipped and answered questions behind the learner", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { answered: ["purpose", "targetDate", "level", "schedule", "placement"] },
        kind: "learn",
        replacesGoalId: null,
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
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toContain("followUps");
  });

  it("skips placement for someone starting from nothing", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { level: "none", purpose: "overview" },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["targetDate", "schedule", "plan"]);
  });

  it("offers the buddy once, in the first onboarding, to learners without one", () => {
    const answered = { answered: ["purpose", "targetDate", "level", "schedule", "placement"] };

    const goal = {
      details: answered,
      kind: "learn" as const,
      replacesGoalId: null,
      targetDate: null,
    };

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
        goal: {
          details: { answered: ["buddy"] },
          kind: "learn",
          replacesGoalId: null,
          targetDate: null,
        },
        profile: NEW_PROFILE,
      }),
    ).not.toContain("buddy");
  });

  it("asks a course start for its optional date, level and time, then places the learner", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { courseStart: { chapterId: null } },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: NEW_PROFILE,
    });

    expect(steps).toStrictEqual(["targetDate", "level", "buddy", "placement", "schedule", "plan"]);
  });

  it("gives a language course its level test, without asking why they learn it", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { courseStart: { chapterId: null } },
        kind: "language",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["targetDate", "level", "placement", "schedule", "plan"]);
  });

  it.each(["exam", "learn", "language"] as const)(
    "asks the learner starting a %s course to answer its populated default date",
    (kind) => {
      expect(
        getOnboardingSteps({
          goal: {
            details: { answered: ["level"], courseStart: { chapterId: null }, level: "none" },
            kind,
            replacesGoalId: null,
            targetDate: "2027-01-31",
          },
          profile: SET_UP_PROFILE,
        }),
      ).toStrictEqual(["targetDate", "schedule", "plan"]);
    },
  );

  it.each(["2027-01-31", null])(
    "skips an exam course's date question once its date %s is answered",
    (targetDate) => {
      expect(
        getOnboardingSteps({
          goal: {
            details: {
              answered: ["targetDate", "level"],
              courseStart: { chapterId: null },
              level: "none",
            },
            kind: "exam",
            replacesGoalId: null,
            targetDate,
          },
          profile: SET_UP_PROFILE,
        }),
      ).toStrictEqual(["schedule", "plan"]);
    },
  );

  it("asks a chapter start for its optional date and time: they chose where to begin", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: { courseStart: { chapterId: "0190c9e2-8f1a-7000-8000-000000000001" } },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["targetDate", "schedule", "plan"]);
  });

  it("skips placement for a course start from scratch, like any goal", () => {
    const steps = getOnboardingSteps({
      goal: {
        details: {
          answered: ["targetDate", "level", "schedule"],
          courseStart: { chapterId: null },
          level: "none",
        },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      },
      profile: SET_UP_PROFILE,
    });

    expect(steps).toStrictEqual(["plan"]);
  });

  it("keeps an exam course's unanswered exam choices in onboarding", () => {
    expect(
      getOnboardingSteps({
        goal: {
          details: { courseStart: { chapterId: null }, level: "none" },
          hasUnpickedChoice: true,
          kind: "exam",
          replacesGoalId: null,
          targetDate: "2027-01-31",
        },
        profile: SET_UP_PROFILE,
      }),
    ).toStrictEqual(["targetDate", "examChoice", "schedule", "plan"]);
  });

  it("has no screens for a quick explanation", () => {
    expect(
      getOnboardingSteps({
        goal: { details: {}, kind: "explain", replacesGoalId: null, targetDate: null },
        profile: NEW_PROFILE,
      }),
    ).toStrictEqual([]);
  });
});

describe(isGoalSetupLeft, () => {
  const courseStart = { chapterId: null };

  it("holds a default plan back while its questions are left, whether words or a course started it", () => {
    expect(
      isGoalSetupLeft({
        details: {
          answered: ["purpose", "targetDate", "level"],
          level: "basic",
          purpose: "overview",
        },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      }),
    ).toBe(true);

    expect(
      isGoalSetupLeft({
        details: { answered: ["level"], courseStart, level: "basic" },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      }),
    ).toBe(true);
  });

  it("lets the plan go once its questions are answered, buddy or not", () => {
    expect(
      isGoalSetupLeft({
        details: { answered: ["level", "targetDate", "placement", "schedule"], courseStart },
        kind: "learn",
        replacesGoalId: null,
        targetDate: null,
      }),
    ).toBe(false);
  });

  it("never holds back the next level of a finished course", () => {
    expect(
      isGoalSetupLeft({
        details: { courseStart },
        kind: "learn",
        replacesGoalId: "finished-goal",
        targetDate: null,
      }),
    ).toBe(false);
  });
});
