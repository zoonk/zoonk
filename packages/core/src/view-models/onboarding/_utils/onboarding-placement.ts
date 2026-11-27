import "server-only";
import { type Goal } from "@zoonk/db";
import { getLanguageLevelTest } from "../../../language/level-test/get-language-level-test";
import {
  LANGUAGE_LEVEL_TEST_OFFER,
  getQuickTestMinutes,
} from "../../../language/level-test/level-test-contract";
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

type PlacementOffer =
  | { placement: PlacementStep }
  | { cold: { parts: number; questions: number; test: PlacementStep["test"]["kind"] } }
  | null;

async function readLanguage({
  goal,
  mode,
}: {
  goal: Goal;
  mode: OfferMode;
}): Promise<PlacementOffer> {
  const read = await getLanguageLevelTest(goal.id);
  const test = { kind: "language" as const };

  if (read.status !== "ready") {
    return null;
  }

  if ("attemptId" in read.test && read.test.attemptId) {
    return { placement: { mode: "resume", test } };
  }

  if (mode === "direct" || (read.test.status === "ready" && read.test.next.kind === "question")) {
    return { placement: { mode, test } };
  }

  return read.test.status === "preparing"
    ? { cold: { parts: 1, questions: LANGUAGE_LEVEL_TEST_OFFER.total, test: "language" } }
    : null;
}

async function readFocus({ goal, mode }: { goal: Goal; mode: OfferMode }): Promise<PlacementOffer> {
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
    return { placement: { mode: "resume", test } };
  }

  if (mode === "direct" || (firstQuestionReady && offer)) {
    return { placement: { mode, test } };
  }

  return offer ? { cold: { parts: 1, questions: offer.questions, test: "focus" } } : null;
}

async function readCourse({
  goal,
  mode,
}: {
  goal: Goal;
  mode: OfferMode;
}): Promise<PlacementOffer> {
  const { attempt, result } = readPlacementAttempt(goal);

  if (attempt || result) {
    return { placement: { mode: "resume", test: { kind: "course", offer: null } } };
  }

  const { offer, ready } = await readCoursePlacementOffer(goal);

  if (mode === "direct" || ready) {
    return { placement: { mode, test: { kind: "course", offer } } };
  }

  return offer ? { cold: { parts: 1, questions: offer.questions, test: "course" } } : null;
}

const SUBJECT_QUESTIONS = new Set<OnboardingStep>(
  ONBOARDING_QUESTIONS.filter((question) => question !== "schedule"),
);

export function hasSubjectQuestions(steps: OnboardingStep[]): boolean {
  return steps.some((step) => SUBJECT_QUESTIONS.has(step));
}

export function readOnboardingPlacementOffer(goal: Goal, mode: OfferMode): Promise<PlacementOffer> {
  if (goal.kind === "language") {
    return readLanguage({ goal, mode });
  }

  if (goal.kind === "exam") {
    return readFocus({ goal, mode });
  }

  return goal.kind === "learn" ? readCourse({ goal, mode }) : Promise.resolve(null);
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

  const outcome = await readOnboardingPlacementOffer(goal, requested ? "direct" : "offer");
  return outcome && "placement" in outcome ? outcome.placement : null;
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
