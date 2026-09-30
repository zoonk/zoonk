import { type EssayRubric } from "@zoonk/ai/tasks/v2/grading/grade-essay";
import { type ExamBlueprint } from "@zoonk/db";
import { getExamScale } from "../scoring/exam-scales";

/** Custom rubrics (Cebraspe discursive answers, school essays) are scored out of ten. */
const CUSTOM_MAX_SCORE = 10;

const ENEM_PATTERN = /\benem\b/iu;
const OAB_PATTERN = /\boab\b/iu;

type RubricRow = { criterion: string; description: string; points: number | null };

/** An AP question's rows, when every one carries its points as its scoring guidelines do. */
function toApRows(criteria: readonly RubricRow[]) {
  const rows = criteria.flatMap(({ criterion, description, points }) =>
    points === null ? [] : [{ criterion, description, points }],
  );

  return rows.length > 0 && rows.length === criteria.length ? rows : null;
}

/**
 * The official rubric an essay is graded with: ENEM's five competencies, OAB's brief section by
 * section, an AP free-response question's rows with their own points, or the item's own criteria
 * for any other exam.
 */
export function getEssayRubric({
  blueprint,
  criteria,
}: {
  blueprint: Pick<ExamBlueprint, "identityKey" | "name"> | null;
  criteria: readonly RubricRow[];
}): EssayRubric {
  const names = blueprint ? `${blueprint.identityKey} ${blueprint.name}` : "";

  if (ENEM_PATTERN.test(names)) {
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
