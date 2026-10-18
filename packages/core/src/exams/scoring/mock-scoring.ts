import { type PartialCreditRule } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockScoring } from "../mocks/mock-contract";
import { type MockScoreNotes } from "../mocks/mock-view-contract";
import { getExamScale, getScoreScale, isEnemExam, toScaleScore } from "./exam-scales";

type ExamNames = {
  blueprint: { identityKey: string; name: string } | null;
  goal: { title: string } | null;
};

/**
 * How a mock is scored, from the exam's notice; plain right answers when it doesn't say. Item
 * response theory scores land on ENEM's scale, which only ENEM uses: every other exam scored that
 * way (Saber 11, the SAT) counts right answers, its result shows the notice's own sentence on how
 * it's scored, and a scale of its own (the SAT's) turns the share into it.
 */
export function getMockScoring({
  blueprint,
  goal,
  structure,
}: ExamNames & { structure: ExamStructure | null }): MockScoring {
  const method = structure?.mock?.scoring.method;
  const isEnem = isEnemExam({ blueprint, goal }) && !getExamScale({ blueprint, goal });

  if (method === "itemResponseTheory" && isEnem) {
    return "irt";
  }

  return method === "wrongCancelsRight" ? "net" : "raw";
}

/**
 * The share of a right answer each wrong one takes away, as the notice states it: its ratio, or a
 * whole one where a wrong answer cancels a right one without saying more; 0 where wrong answers
 * cost nothing.
 */
export function getWrongPenalty(structure: ExamStructure | null): number {
  const scoring = structure?.mock?.scoring;

  if (scoring?.method !== "wrongCancelsRight") {
    return 0;
  }

  return scoring.wrongPenalty ?? 1;
}

/**
 * How a question with several picks scores when answered partly right, as the notice states it for
 * the exam's multi-pick format; only every right option earns it where the notice doesn't say.
 */
export function getPartialCredit(structure: ExamStructure | null): PartialCreditRule {
  const stated = structure?.formats.find(
    (format) => format.kind === "multipleChoice" && format.partialCredit,
  );

  return stated?.partialCredit ?? "allOrNothing";
}

/** Notice methods a mock's right answers don't reproduce: the result says the notice's own words. */
const OWN_WAY_METHODS = new Set(["itemResponseTheory", "other", "scaled"]);

/**
 * What a mock's result says about the real score: the exam's own scale with the mock's right
 * answers on it where the map is known (`share`, right answers over questions, once it's over),
 * the notice's own sentence on how the exam is scored where the mock only counts right answers (an
 * exam scored with item response theory that isn't ENEM, a scaled or another method) and the
 * scale doesn't say it already, and that the real result depends on everyone in the sitting (a
 * percentile, a standardized score, a curve).
 */
export function getScoreNotes({
  blueprint,
  goal,
  scoring,
  share,
  structure,
}: ExamNames & {
  scoring: MockScoring;
  share: number | null;
  structure: ExamStructure | null;
}): MockScoreNotes {
  const notice = structure?.mock?.scoring;
  const ownWay = scoring === "raw" && OWN_WAY_METHODS.has(notice?.method ?? "raw");
  const scale = scoring === "irt" ? null : getScoreScale({ blueprint, goal, structure });

  return {
    noticeScoring: ownWay && notice?.description && !scale ? notice.description : null,
    relative: notice?.relative === true,
    scale: scale && {
      max: scale.max,
      min: scale.min,
      name: scale.name,
      passScore: scale.passScore,
      score: share === null ? null : toScaleScore({ scale, share }),
    },
  };
}
