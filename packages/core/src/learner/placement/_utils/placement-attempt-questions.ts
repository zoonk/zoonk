import { MS_PER_MINUTE } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import {
  LOW_GUESS_ANSWERS_TO_SKIP,
  isLowGuessTap,
  isQuickChoice,
} from "../../_utils/placement-guess-rate";
import { type PlacementEvidence } from "../placement-beliefs";
import { getPlacementBudgetSpent } from "../placement-budget";
import { type PlacementItemCandidate, pickPlacementItem } from "../placement-item-choice";
import { listKnownSkillIds } from "../placement-known";
import { readWholeCourseWalk } from "../whole-course-walk";
import { getWholeCourseMinutes, type readPlacementAttempt } from "./placement-attempt-record";
import { type loadEvidence, toPlacementEvidence } from "./placement-evidence";
import { type loadPlanBuild } from "./placement-plan-build";

const PART_MS = 10 * MS_PER_MINUTE;
const PART_ANSWERS = 30;
const MIN_PACED_ANSWERS = 5;

type Attempt = NonNullable<ReturnType<typeof readPlacementAttempt>["attempt"]>;

function toScope(ids: string[] | undefined) {
  return ids ? new Set(ids) : null;
}

function estimateRemaining({
  attempt,
  given,
  questions,
}: {
  attempt: Attempt;
  given: readonly { answer: unknown; durationMs: number }[];
  questions: number;
}) {
  if (attempt.length === "quick") {
    return attempt.estimatedMinutes;
  }

  const timed = given.filter(({ answer, durationMs }) => durationMs > 0 && !isDontKnow(answer));

  const elapsed = timed.reduce(
    (total, answer) => total + Math.min(answer.durationMs, MS_PER_MINUTE),
    0,
  );

  return getWholeCourseMinutes({
    paceMs: timed.length >= MIN_PACED_ANSWERS ? elapsed / timed.length : undefined,
    questions,
  });
}

function isDontKnow(answer: unknown) {
  return isJsonObject(answer) && answer.dontKnow === true;
}

function answersSinceMiss(answers: readonly PlacementEvidence[]) {
  return answers.slice(answers.findLastIndex((answer) => answer.outcome !== "correct") + 1);
}

function questionsRemaining(answers: readonly PlacementEvidence[]) {
  const hasQuick = answers.some((answer) => isQuickChoice(answer));
  const lowGuess = answers.filter((answer) => isLowGuessTap(answer)).length;
  return Number(!hasQuick) + Math.max(0, LOW_GUESS_ANSWERS_TO_SKIP - lowGuess);
}

function listQuickFollowUps({
  bySkill,
  known,
}: {
  bySkill: ReadonlyMap<string, readonly PlacementEvidence[]>;
  known: ReadonlySet<string>;
}): string[] {
  return [...bySkill].flatMap(([skillId, answers]) =>
    !known.has(skillId) &&
    answers.every((answer) => answer.outcome === "correct") &&
    answers.some((answer) => isQuickChoice(answer))
      ? [skillId]
      : [],
  );
}

export function readAttemptQuestions({
  attempt,
  attempts,
  build,
  items,
  plan,
  today,
}: {
  attempt: Attempt;
  attempts: Awaited<ReturnType<typeof loadEvidence>>["attempts"];
  build: Pick<Awaited<ReturnType<typeof loadPlanBuild>>, "preparingSkillIds">;
  items: readonly PlacementItemCandidate[];
  plan: GoalPlan;
  today: Date | null;
}) {
  const given = attempts.filter((answer) => answer.focusTestId === attempt.id);

  const part = given.filter(
    (answer) => answer.answeredAt.getTime() >= Date.parse(attempt.partStartedAt),
  );

  const answers = given.flatMap((attemptRow) => toPlacementEvidence(attemptRow) ?? []);

  const skillIds = new Set(
    attempt.skillIds.length > 0 ? attempt.skillIds : plan.skills.map((skill) => skill.id),
  );

  const skills = plan.skills.filter((skill) => skillIds.has(skill.id) && !skill.removed);
  const whole = attempt.length === "wholeCourse";

  const elapsed = part.reduce(
    (total, answer) => total + Math.min(answer.durationMs, MS_PER_MINUTE),
    0,
  );

  const spent = whole
    ? Math.min(1, Math.max(elapsed / PART_MS, part.length / PART_ANSWERS))
    : getPlacementBudgetSpent(
        given.filter((answer) => !today || answer.localDate.getTime() === today.getTime()),
      );

  const partAnsweredItemIds = new Set(part.flatMap((answer) => answer.itemId ?? []));
  const walk = whole ? readWholeCourseWalk({ answers, partAnsweredItemIds, skills }) : null;

  const knownSkillIds = walk
    ? [...walk.confirmed]
    : listKnownSkillIds({ answers, evidence: answers, skillIds: [...skillIds] });

  const known = new Set(knownSkillIds);
  const bySkill = Map.groupBy(answers, (answer) => answer.skillId);
  const unanswered = (walk ? walk.ready : skills).filter((skill) => !known.has(skill.id));

  const candidates = Map.groupBy(
    items.filter((item) => !item.seen),
    (item) => item.skillId,
  );

  const nextIn = (skillId: string) => {
    const tried = answersSinceMiss(bySkill.get(skillId) ?? []);
    const hasQuick = tried.some((answer) => isQuickChoice(answer));

    const suitable = (candidates.get(skillId) ?? []).filter((item) =>
      hasQuick ? isLowGuessTap(item) : isQuickChoice(item),
    );

    return pickPlacementItem({ confirming: hasQuick, items: suitable, skillId });
  };

  const ready = whole
    ? unanswered
    : unanswered
        .filter(
          (skill) => !(bySkill.get(skill.id) ?? []).some((answer) => answer.outcome !== "correct"),
        )
        .toSorted((a, b) => Number(bySkill.has(b.id)) - Number(bySkill.has(a.id)));

  const partScope = toScope(attempt.partSkillIds);
  const inPart = (skill: { id: string }) => !partScope || partScope.has(skill.id);
  const stillInWalk = toScope(attempt.remainingSkillIds);
  const isRemaining = (skill: { id: string }) => !stillInWalk || stillInWalk.has(skill.id);

  const next = ready
    .filter((skill) => inPart(skill) && isRemaining(skill))
    .map((skill) => ({ item: nextIn(skill.id), waiting: build.preparingSkillIds.has(skill.id) }))
    .find((skill) => skill.item || skill.waiting);

  const deferred = new Set(
    walk?.remaining.filter((skill) => !walk.ready.includes(skill)).map((skill) => skill.id),
  );

  const remainingSkillIds =
    walk?.remaining
      .filter((skill) => isRemaining(skill))
      .filter(
        (skill) =>
          !inPart(skill) ||
          deferred.has(skill.id) ||
          nextIn(skill.id) ||
          build.preparingSkillIds.has(skill.id),
      )
      .map((skill) => skill.id) ?? [];

  const questions = remainingSkillIds.reduce(
    (total, skillId) => total + questionsRemaining(answersSinceMiss(bySkill.get(skillId) ?? [])),
    0,
  );

  const estimatedMinutes = estimateRemaining({ attempt, given, questions });

  return {
    answered: part.length,
    complete: !next,
    estimatedMinutes,
    followUpSkillIds: whole ? [] : listQuickFollowUps({ bySkill, known }),
    hasMore: whole ? remainingSkillIds.length > 0 : Boolean(next),
    item: attempt.partComplete || spent >= 1 ? null : (next?.item ?? null),
    knownSkillIds,
    remainingSkillIds,
    spent,
    waiting: Boolean(next?.waiting && !next.item),
  };
}
