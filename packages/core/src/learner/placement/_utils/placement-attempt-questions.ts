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
  const [nextSkillId] = remainingTopics;

  const item = nextSkillId
    ? pickTopicQuestion({
        answers: bySkill.get(nextSkillId) ?? [],
        items: candidates.get(nextSkillId) ?? [],
        skillId: nextSkillId,
      })
    : null;

  const capped = partAnswers.length >= questions;
  const complete = capped || !nextSkillId;
  const blocked = Boolean(nextSkillId && !item && !complete);
  const waiting = blocked && nextSkillId !== undefined && build.preparingSkillIds.has(nextSkillId);

  const preparationFailed = didPreparationFail({
    answered: partAnswers.length,
    attempt,
    blocked,
    waiting,
  });

  const remainingParts = parts
    .map((ids, index) => ({ ids: ids.filter((id) => remaining.has(id)), part: index + 1 }))
    .filter(
      ({ ids, part }) =>
        ids.length > 0 &&
        (part > attempt.part || (part === attempt.part && !complete && !attempt.partComplete)),
    );

  const nextPart = remainingParts.find(({ part }) => part > attempt.part);

  return {
    answered: partAnswers.length,
    chapter: item
      ? (plan.skills.find((skill) => skill.id === item.skillId)?.areaTitle ?? null)
      : null,
    complete,
    end: getEnd({ capped, complete }),
    estimatedMinutes: getCourseMinutes(questions),
    item: attempt.partComplete || attempt.paused || complete ? null : item,
    knownSkillIds: [...walk.confirmed],
    nextPart,
    partAnswers: partAnswers.map((row) => row.skillId),
    parts: parts.length,
    partsLeft: remainingParts.length,
    preparationFailed,
    questions,
    remainingTopics,
    totalEstimatedMinutes: getCourseMinutes(parts.flat().length * QUESTIONS_PER_TOPIC),
    unknowns: partAnswers.filter((row) => toPlacementEvidence(row)?.outcome === "dontKnow").length,
    waiting,
  };
}
