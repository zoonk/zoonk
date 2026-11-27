import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { courseSearch } from "../course-search";
import { getCourseMinutes } from "../placement-budget";
import { listKnownSkillIds } from "../placement-known";
import { type PlacementAttempt } from "./placement-attempt-record";
import { type loadEvidence, toPlacementEvidence } from "./placement-evidence";

export function readAttemptQuestions({
  attempt,
  attempts,
  plan,
}: {
  attempt: PlacementAttempt;
  attempts: Awaited<ReturnType<typeof loadEvidence>>["attempts"];
  plan: GoalPlan;
}) {
  const given = attempts.filter(
    (answer) => answer.focusTestId === attempt.id && answer.itemId !== null,
  );
  const evidence = given.flatMap((row) => toPlacementEvidence(row) ?? []);
  const search = attempt.search;
  const answers = given.flatMap((answer) =>
    answer.itemId ? [{ itemId: answer.itemId, correct: answer.isCorrect }] : [],
  );
  const choice = search?.topics
    ? courseSearch({
        topics: search.topics,
        position: search.position,
        ceiling: search.questions,
        answers,
      })
    : null;
  const itemId = choice?.itemId ?? null;
  const topic = search?.topics?.find((t) => itemId && t.itemIds.includes(itemId));
  const startedPastSkillIds = [...(choice?.startedPast ?? [])];
  const waiting = search?.topics === null;
  const complete = !itemId && !waiting;
  const questions = search?.questions ?? Math.max(1, given.length);
  const legacyKnown = search
    ? []
    : listKnownSkillIds({
        answers: evidence,
        evidence,
        skillIds: plan.skills.map((skill) => skill.id),
      });
  const end = !complete
    ? "stopped"
    : given.length >= questions
      ? "question_cap"
      : search
        ? "found"
        : "material_exhausted";
  return {
    answered: given.length,
    chapter: topic?.chapter ?? null,
    complete,
    durationMs: given.reduce((sum, a) => sum + a.durationMs, 0),
    end,
    estimatedMinutes: getCourseMinutes(questions),
    itemId,
    knownSkillIds: legacyKnown,
    partAnswers: given.map((answer) => answer.skillId),
    questions,
    startedPastSkillIds,
    unknowns: evidence.filter((answer) => answer.outcome === "dontKnow").length,
    waiting,
  } as const;
}
