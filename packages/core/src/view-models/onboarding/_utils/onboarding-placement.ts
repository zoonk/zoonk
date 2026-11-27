import "server-only";
import { type Goal } from "@zoonk/db";
import { getLanguageLevelTest } from "../../../language/level-test/get-language-level-test";
import { getQuickTestMinutes } from "../../../language/level-test/level-test-contract";
import { loadPlacementPlan } from "../../../learner/_utils/goal-skill-graph";
import { readCoursePlacementOffer } from "../../../learner/placement/_utils/course-placement-offer";
import { loadPlacementWithSummary } from "../../../learner/placement/_utils/load-placement-state";
import { readPlacementAttempt } from "../../../learner/placement/_utils/placement-attempt-record";
import { readFocusTestRecord } from "../../../learner/placement/focus-test-state";
import {
  ONBOARDING_QUESTIONS,
  type OnboardingStep,
  type OnboardingView,
} from "../onboarding-contract";

type PlacementStep = NonNullable<OnboardingView["placement"]>;
type OfferMode = "direct" | "offer";

async function readLanguage({
  goal,
  mode,
}: {
  goal: Goal;
  mode: OfferMode;
}): Promise<PlacementStep | null> {
  const read = await getLanguageLevelTest(goal.id);
  const test = { kind: "language" as const };

  if (read.status !== "ready") {
    return null;
  }

  if ("attemptId" in read.test && read.test.attemptId) {
    return { mode: "resume", test };
  }

  return mode === "direct" || (read.test.status === "ready" && read.test.next.kind === "question")
    ? { mode, test }
    : null;
}

async function readFocus({
  goal,
  mode,
}: {
  goal: Goal;
  mode: OfferMode;
}): Promise<PlacementStep | null> {
  const record = readFocusTestRecord(goal);

  const { firstQuestionReady, state } = await loadPlacementWithSummary({
    checkReadiness: true,
    goalId: goal.id,
    plan: await loadPlacementPlan(goal.id),
    userId: goal.userId,
  });

  const offer = state.focusTest?.offer ?? null;
  const test = { kind: "focus" as const, offer };

  if (record?.sitting || state.focusTest?.checkpoint) {
    return { mode: "resume", test };
  }

  return mode === "direct" || (firstQuestionReady && offer) ? { mode, test } : null;
}

async function readCourse({
  goal,
  mode,
}: {
  goal: Goal;
  mode: OfferMode;
}): Promise<PlacementStep | null> {
  const { attempt, result } = readPlacementAttempt(goal);

  if (attempt || result) {
    return { mode: "resume", test: { kind: "course", offer: null } };
  }

  const { offer, ready } = await readCoursePlacementOffer({ checkReadiness: true, goal });
  return mode === "direct" || ready ? { mode, test: { kind: "course", offer } } : null;
}

const SUBJECT_QUESTIONS = new Set<OnboardingStep>(
  ONBOARDING_QUESTIONS.filter((question) => question !== "schedule"),
);

export function hasSubjectQuestions(steps: OnboardingStep[]): boolean {
  return steps.some((step) => SUBJECT_QUESTIONS.has(step));
}

export async function readOnboardingPlacement({
  goal,
  requested,
  steps,
}: {
  goal: Goal;
  requested: boolean;
  steps: OnboardingStep[];
}): Promise<OnboardingView["placement"]> {
  const index = steps.indexOf("placement");

  if (index === -1 || hasSubjectQuestions(steps.slice(0, index))) {
    return null;
  }

  const mode = requested ? "direct" : "offer";

  if (goal.kind === "language") {
    return readLanguage({ goal, mode });
  }

  if (goal.kind === "exam") {
    return readFocus({ goal, mode });
  }

  return goal.kind === "learn" ? readCourse({ goal, mode }) : null;
}

export function readQuickTestMinutes({
  kind,
  placement,
}: {
  kind: Goal["kind"];
  placement: OnboardingView["placement"];
}): number {
  const test = placement?.test;

  if (test?.kind === "course" && test.offer) {
    return test.offer.estimatedMinutes;
  }

  if (test?.kind === "focus" && test.offer) {
    return test.offer.minutes;
  }

  return getQuickTestMinutes(kind);
}
