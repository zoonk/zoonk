import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { isLowGuessTap, isQuickChoice } from "../../_utils/placement-guess-rate";
import { getPlacementBudgetSpent } from "../placement-budget";
import { type PlacementItemCandidate, pickPlacementItem } from "../placement-item-choice";
import { listKnownSkillIds } from "../placement-known";
import { readWholeCourseWalk } from "../whole-course-walk";
import { getPlacementEstimate, type readPlacementAttempt } from "./placement-attempt-record";
import { type loadEvidence, toPlacementEvidence } from "./placement-evidence";
import { type loadPlanBuild } from "./placement-plan-build";

const MINUTE_MS = 60_000;
const PART_MS = 10 * MINUTE_MS;
const PART_ANSWERS = 30;

type Attempt = NonNullable<ReturnType<typeof readPlacementAttempt>["attempt"]>;

function estimateRemaining({
  attempt,
  given,
  remaining,
}: {
  attempt: Attempt;
  given: readonly { durationMs: number }[];
  remaining: number;
}) {
  if (attempt.length === "quick") {
    return attempt.estimatedMinutes;
  }

  const completed = Math.max(0, attempt.topicCount - remaining);

  const elapsed = given.reduce(
    (total, answer) => total + Math.min(answer.durationMs, MINUTE_MS),
    0,
  );

  return completed > 0 && elapsed > 0
    ? Math.ceil(((elapsed / completed) * remaining) / MINUTE_MS)
    : getPlacementEstimate({ length: attempt.length, topics: remaining });
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

  const elapsed = part.reduce((total, answer) => total + Math.min(answer.durationMs, MINUTE_MS), 0);

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
    const history = bySkill.get(skillId) ?? [];

    const tried = history.slice(
      history.findLastIndex((answer) => answer.outcome !== "correct") + 1,
    );

    const hasQuick = tried.some((answer) => answer.outcome === "correct" && isQuickChoice(answer));

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

  const next = ready
    .map((skill) => ({ item: nextIn(skill.id), waiting: build.preparingSkillIds.has(skill.id) }))
    .find((skill) => skill.item || skill.waiting);

  const remaining = walk?.remaining.length ?? ready.length;
  const estimatedMinutes = estimateRemaining({ attempt, given, remaining });

  return {
    answered: part.length,
    complete: !next?.item && !next?.waiting,
    estimatedMinutes,
    hasMore:
      Boolean(next) ||
      Boolean(walk?.remaining.some((skill) => !walk.ready.includes(skill) && nextIn(skill.id))),
    item: attempt.partComplete || spent >= 1 ? null : (next?.item ?? null),
    knownSkillIds,
    spent,
    waiting: Boolean(next?.waiting && !next.item),
  };
}
