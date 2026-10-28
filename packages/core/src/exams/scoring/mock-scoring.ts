import { type PartialCreditRule } from "@zoonk/ai/tasks/v2/research/partial-credit";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockScoring } from "../mocks/mock-contract";
import { type MockScoreNotes } from "../mocks/mock-view-contract";
import { getExamScale, getScoreScale, isEnemExam, toScaleScore } from "./exam-scales";

type ExamNames = {
  blueprint: { identityKey: string; name: string } | null;
  goal: { title: string } | null;
};

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

export function getWrongPenalty(structure: ExamStructure | null): number {
  const scoring = structure?.mock?.scoring;

  if (scoring?.method !== "wrongCancelsRight") {
    return 0;
  }

  return scoring.wrongPenalty ?? 1;
}

export function getPartialCredit(structure: ExamStructure | null): PartialCreditRule {
  const stated = structure?.formats.find(
    (format) => format.kind === "multipleChoice" && format.partialCredit,
  );

  return stated?.partialCredit ?? "allOrNothing";
}

const OWN_WAY_METHODS = new Set(["itemResponseTheory", "other", "scaled"]);

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
