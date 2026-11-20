import { createHash } from "node:crypto";
import { type z } from "zod";
import { type writtenItemSchema } from "./writing-contract";

type Basis = Pick<
  z.infer<typeof writtenItemSchema>,
  "charactersPerLine" | "grading" | "lines" | "minimumWords" | "points"
>;

export type WritingArithmetic = {
  rounding: { mode: "nearest" | "down"; places: number } | null;
  zeroRules: readonly number[];
};

type PassedEvaluation = {
  corpus: string;
  model: string;
  promptRevision: string;
  arithmetic: WritingArithmetic;
};

const passedEvaluations: Readonly<Record<string, PassedEvaluation>> = {};

export function getWritingArithmetic(
  basis: Basis,
  observed?: { model: string; promptVersion: string },
): WritingArithmetic | null {
  const { charactersPerLine, grading, lines, minimumWords, points } = basis;

  if (grading.kind !== "points" || points === null || grading.criteria.length === 0) {
    return null;
  }

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        { charactersPerLine, grading, lines, minimumWords, points },
        (key, value: unknown) => (key === "sourceId" ? undefined : value),
      ),
    )
    .digest("hex");

  const passed = passedEvaluations[fingerprint];

  if (
    !passed ||
    (observed &&
      (passed.model !== observed.model || passed.promptRevision !== observed.promptVersion))
  ) {
    return null;
  }

  return passed.arithmetic;
}

export function isNumericWritingRubric(basis: Basis): boolean {
  return getWritingArithmetic(basis) !== null;
}
