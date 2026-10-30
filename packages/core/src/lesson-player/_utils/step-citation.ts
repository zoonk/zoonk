import { type Source, type Step } from "@zoonk/db";
import { getMaterialUnit } from "../../library/sources/material-pages";
import { toSourceCitation } from "../../library/sources/source-citation";
import { type LessonStepCitation, type PlayableLibraryStep } from "../playable-lesson";

type CitedRow = Pick<Step, "sourcePage"> & {
  source: Pick<
    Source,
    "fetchedAt" | "kind" | "mimeType" | "publisher" | "title" | "url" | "visibility"
  > | null;
};

function citesMaterial(row: CitedRow): boolean {
  return row.source?.kind === "upload" && row.source.visibility === "private";
}

export function getStepCitation(row: CitedRow): LessonStepCitation | null {
  const { source } = row;

  if (!source) {
    return null;
  }

  if (citesMaterial(row)) {
    return {
      kind: "material",
      page: row.sourcePage,
      title: source.title,
      unit: getMaterialUnit(source.mimeType),
    };
  }

  return { kind: "source", ...toSourceCitation(source) };
}

/** Unsupported explanations must be labeled beyond the learner's material rather than presented as covered by it. */
export function markExplanationsNotInMaterial({
  rows,
  steps,
}: {
  rows: readonly CitedRow[];
  steps: PlayableLibraryStep[];
}): PlayableLibraryStep[] {
  if (!rows.some((row) => citesMaterial(row))) {
    return steps;
  }

  return steps.map((step) =>
    step.kind === "explanation" && step.citation === null
      ? { ...step, citation: { kind: "notInMaterial" } }
      : step,
  );
}
