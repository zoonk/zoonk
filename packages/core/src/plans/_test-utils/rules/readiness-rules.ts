import { type RuleContext, type RuleViolation } from "./rule-context";

/** Preparation from here on reads as Solid, the ring's last stage. */
const SOLID = 0.75;

/** Floating-point sums of importance may land a hair above coverage. */
const EPSILON = 1e-9;

/** The finished mocks an estimate reads: the latest ones. */
const RECENT_MOCKS = 3;

/** The questions the recent mocks need between them before a score is estimated. */
const MIN_ESTIMATE_QUESTIONS = 30;

/** Where an answer shows a skill was studied: any answer in its lessons, a right one in practice. */
const PRACTICE_SOURCES = new Set(["mock", "practice", "review"]);

/**
 * R34. Readiness counts only what the learner showed: preparation's coverage never counts more
 * skills as studied than those with an answer in their lessons, a lesson they finished (the plan's
 * skill it counts for: its answers may land on finer skills of its own, or on none) or a right
 * answer in practice (a session, a review, a mock). Placement, a test-out, a ticked subject or a
 * stated level don't count until practice confirms them.
 */
export function checkCoverageShown(context: RuleContext): RuleViolation[] {
  const { after, answers, finishedLessons = [], preparation } = context;

  if (!answers || !preparation) {
    return [];
  }

  const planSkillIds = new Set(after.graph.skills.map((skill) => skill.skillId));

  const shown = new Set([
    ...answers
      .filter(
        (answer) =>
          answer.source === "lesson" || (answer.correct && PRACTICE_SOURCES.has(answer.source)),
      )
      .map((answer) => answer.skillId),
    ...finishedLessons.flatMap((lesson) =>
      lesson.skillIds.filter((skillId) => planSkillIds.has(skillId)),
    ),
  ]);

  const counted = preparation.components.coverage.studiedSkills;

  return counted > shown.size
    ? [
        {
          details: { counted, shown: shown.size },
          message: "Preparation counts skills as studied that the learner never showed.",
          rule: "R34",
        },
      ]
    : [];
}

/**
 * R35. Readiness never says more than the evidence: it's never above the share of the goal studied,
 * and it reads Solid only after a test in real conditions (a mock, a full review, a weekly
 * challenge).
 */
export function checkReadinessHonest(context: RuleContext): RuleViolation[] {
  const { preparation } = context;

  if (!preparation) {
    return [];
  }

  const { coverage, mocks } = preparation.components;

  return [
    preparation.value > coverage.value + EPSILON && { coverage: coverage.value },
    preparation.value >= SOLID && mocks.taken === 0 && { mocksTaken: 0 },
  ]
    .filter((problem) => problem !== false)
    .map((details) => ({
      details: { value: preparation.value, ...details },
      message: "Preparation says more than the evidence does.",
      rule: "R35",
    }));
}

/**
 * R36. An estimated score shows only as a range, and only once the latest three mocks hold at
 * least 30 questions between them and not every one of them sat a single subject.
 */
export function checkScoreEstimateEarned(context: RuleContext): RuleViolation[] {
  const estimate = context.preparation?.estimatedScore ?? null;

  if (!context.preparation || !estimate) {
    return [];
  }

  const recent = context.preparation.mocks
    .filter((mock) => mock.questions > 0)
    .toSorted((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
    .slice(0, RECENT_MOCKS);

  const questions = recent.reduce((sum, mock) => sum + mock.questions, 0);
  const subjectOnly = recent.length > 0 && recent.every((mock) => mock.subjectOnly);

  return [
    questions < MIN_ESTIMATE_QUESTIONS && { questions },
    subjectOnly && { subjectOnly },
    estimate.low >= estimate.high && { range: false },
  ]
    .filter((problem) => problem !== false)
    .map((details) => ({
      details,
      message: "An estimated score shows without the mocks it needs, or not as a range.",
      rule: "R36",
    }));
}
