import { type EssayRubric } from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { type ExamBlueprint } from "@zoonk/db";
import { getExamScale, isEnemExam } from "../scoring/exam-scales";

const CUSTOM_MAX_SCORE = 10;

const OAB_PATTERN = /\boab\b/iu;

type RubricRow = { criterion: string; description: string; points: number | null };

function toApRows(criteria: readonly RubricRow[]) {
  const rows = criteria.flatMap(({ criterion, description, points }) =>
    points === null ? [] : [{ criterion, description, points }],
  );

  return rows.length > 0 && rows.length === criteria.length ? rows : null;
}

export function getEssayRubric({
  blueprint,
  criteria,
}: {
  blueprint: Pick<ExamBlueprint, "identityKey" | "name"> | null;
  criteria: readonly RubricRow[];
}): EssayRubric {
  const names = blueprint ? `${blueprint.identityKey} ${blueprint.name}` : "";

  if (isEnemExam({ blueprint, goal: null })) {
    return { kind: "enem" };
  }

  if (OAB_PATTERN.test(names)) {
    return { kind: "oab" };
  }

  const apRows = getExamScale({ blueprint, goal: null }) === "ap" ? toApRows(criteria) : null;

  if (apRows) {
    return { criteria: apRows, kind: "ap" };
  }

  return {
    criteria: criteria.map(({ criterion, description }) => ({ criterion, description })),
    kind: "custom",
    maxScore: CUSTOM_MAX_SCORE,
  };
}
