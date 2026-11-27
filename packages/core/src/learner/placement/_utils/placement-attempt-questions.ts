import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { isLowGuessTap, isQuickChoice } from "../../_utils/placement-guess-rate";
import { type PlacementEvidence } from "../placement-beliefs";
import { type PlacementItemCandidate, pickPlacementItem } from "../placement-item-choice";
import { readWholeCourseWalk } from "../whole-course-walk";
import {
  PART_QUESTIONS,
  type PlacementAttempt,
  QUESTIONS_PER_TOPIC,
  getAttemptParts,
  getCourseMinutes,
  getTopicsAhead,
} from "./placement-attempt-record";
import { type loadEvidence, toPlacementEvidence } from "./placement-evidence";
import { type loadPlanBuild } from "./placement-plan-build";

function pickTopicQuestion({
  answers,
  items,
  skillId,
}: {
  answers: readonly PlacementEvidence[];
  items: readonly PlacementItemCandidate[];
  skillId: string;
}) {
  const confirming = answers.some((answer) => isQuickChoice(answer));
  const suitable = items.filter((item) => (confirming ? isLowGuessTap(item) : isQuickChoice(item)));

  return pickPlacementItem({ confirming, items: suitable, skillId });
}

function nextPartQuestion({
  remainingTopics,
  bySkill,
  candidates,
  preparingSkillIds,
}: {
  remainingTopics: readonly string[];
  bySkill: ReadonlyMap<string, readonly PlacementEvidence[]>;
  candidates: ReadonlyMap<string, readonly PlacementItemCandidate[]>;
  preparingSkillIds: ReadonlySet<string>;
}) {
  for (const skillId of remainingTopics) {
    const item = pickTopicQuestion({
      answers: bySkill.get(skillId) ?? [],
      items: candidates.get(skillId) ?? [],
      skillId,
    });

    if (item || preparingSkillIds.has(skillId)) {
      return { item, waiting: !item };
    }
  }

  return { item: null, waiting: false };
}

function getEnd({
  capped,
  complete,
}: {
  capped: boolean;
  complete: boolean;
}): "question_cap" | "material_exhausted" | "stopped" {
  if (capped) {
    return "question_cap";
  }

  return complete ? "material_exhausted" : "stopped";
}

function didPreparationFail({
  answered,
  attempt,
  blocked,
  waiting,
}: {
  answered: number;
  attempt: PlacementAttempt;
  blocked: boolean;
  waiting: boolean;
}) {
  return (
    blocked &&
    !waiting &&
    answered === 0 &&
    (attempt.partPreparationFailed === true || attempt.partPrepared === false)
  );
}

function countRemainingQuestions(
  ids: readonly string[],
  bySkill: ReadonlyMap<string, readonly PlacementEvidence[]>,
) {
  return ids.reduce(
    (total, id) => total + Math.max(0, QUESTIONS_PER_TOPIC - (bySkill.get(id)?.length ?? 0)),
    0,
  );
}

function readPartProgress({
  bySkill,
  currentAllowance,
  currentTopics,
  part,
  parts,
  remaining,
}: {
  bySkill: ReadonlyMap<string, readonly PlacementEvidence[]>;
  currentAllowance: number;
  currentTopics: string[];
  part: number;
  parts: string[][];
  remaining: ReadonlySet<string>;
}) {
  // Only future parts can move. The current number identifies answers, receipts and preparation.
  const futureParts = parts
    .slice(part)
    .map((ids) => ids.filter((id) => remaining.has(id)))
    .filter((ids) => ids.length > 0);

  const retainedParts = [...parts.slice(0, part), ...futureParts];
  const [nextTopics] = futureParts;

  const currentQuestions = Math.min(
    currentAllowance,
    countRemainingQuestions(currentTopics, bySkill),
  );

  const remainingQuestions =
    currentQuestions + countRemainingQuestions(futureParts.flat(), bySkill);

  const totalQuestions = retainedParts.reduce(
    (total, ids) => total + Math.min(PART_QUESTIONS, ids.length * QUESTIONS_PER_TOPIC),
    0,
  );

  return {
    nextPart: nextTopics ? { ids: nextTopics, part: part + 1 } : undefined,
    parts: retainedParts.length,
    partsLeft: futureParts.length + Number(currentAllowance > 0),
    remainingEstimatedMinutes: getCourseMinutes(remainingQuestions),
    retainedParts,
    totalEstimatedMinutes: getCourseMinutes(totalQuestions),
  };
}

export function readAttemptQuestions({
  attempt,
  attempts,
  build,
  items,
  plan,
}: {
  attempt: PlacementAttempt;
  attempts: Awaited<ReturnType<typeof loadEvidence>>["attempts"];
  build: Pick<Awaited<ReturnType<typeof loadPlanBuild>>, "preparingSkillIds">;
  items: readonly PlacementItemCandidate[];
  plan: GoalPlan;
}) {
  const given = attempts.filter((answer) => answer.focusTestId === attempt.id);

  const answers = given.flatMap((row) => toPlacementEvidence(row) ?? []);
  const bySkill = Map.groupBy(answers, (answer) => answer.skillId);
  const parts = getAttemptParts(attempt);
  const current = attempt.partSkillIds ?? parts[attempt.part - 1] ?? [];
  const currentTopics = new Set(current);

  const partAnswers = attempt.parts
    ? given.filter((answer) => answer.skillId !== null && currentTopics.has(answer.skillId))
    : given.filter((answer) => answer.answeredAt.getTime() >= Date.parse(attempt.partStartedAt));

  const walk = readWholeCourseWalk({ answers, skills: plan.skills });
  const ahead = new Set(getTopicsAhead(plan).map((skill) => skill.id));

  const remaining = new Set(
    walk.remaining.filter((skill) => ahead.has(skill.id)).map((skill) => skill.id),
  );

  const candidates = Map.groupBy(
    items.filter((item) => !item.seen),
    (item) => item.skillId,
  );

  const questions = attempt.parts
    ? Math.min(PART_QUESTIONS, current.length * QUESTIONS_PER_TOPIC)
    : PART_QUESTIONS;

  const remainingTopics = current.filter((id) => remaining.has(id));

  const { item, waiting } = nextPartQuestion({
    bySkill,
    candidates,
    preparingSkillIds: build.preparingSkillIds,
    remainingTopics,
  });

  const capped = partAnswers.length >= questions;

  const preparationFailed = didPreparationFail({
    answered: partAnswers.length,
    attempt,
    blocked: remainingTopics.length > 0 && !item,
    waiting,
  });

  const complete = capped || (!item && !waiting && !preparationFailed);
  const partOver = complete || attempt.partComplete;

  const progress = readPartProgress({
    bySkill,
    currentAllowance: partOver ? 0 : questions - partAnswers.length,
    currentTopics: remainingTopics,
    part: attempt.part,
    parts,
    remaining,
  });

  return {
    ...progress,
    answered: partAnswers.length,
    chapter: item
      ? (plan.skills.find((skill) => skill.id === item.skillId)?.areaTitle ?? null)
      : null,
    complete,
    durationMs: partAnswers.reduce((total, answer) => total + answer.durationMs, 0),
    end: getEnd({ capped, complete }),
    estimatedMinutes: getCourseMinutes(questions),
    item: partOver || attempt.paused ? null : item,
    knownSkillIds: [...walk.confirmed],
    partAnswers: partAnswers.map((row) => row.skillId),
    preparationFailed,
    questions,
    remainingTopics,
    unknowns: partAnswers.filter((row) => toPlacementEvidence(row)?.outcome === "dontKnow").length,
    waiting,
  };
}
