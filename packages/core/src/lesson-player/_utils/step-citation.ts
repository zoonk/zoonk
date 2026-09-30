import { type Source, type Step } from "@zoonk/db";
import { getMaterialUnit } from "../../library/sources/material-pages";
import { toSourceCitation } from "../../library/sources/source-citation";
import { type LessonStepCitation, type PlayableLibraryStep } from "../contract";

/** What a screen's citation reads from its stored step: the source it cites and the page. */
type CitedRow = Pick<Step, "sourcePage"> & {
  source: Pick<
    Source,
    "fetchedAt" | "kind" | "mimeType" | "publisher" | "title" | "url" | "visibility"
  > | null;
};

/** A page of the learner's own material: a private upload, never a public source. */
function citesMaterial(row: CitedRow): boolean {
  return row.source?.kind === "upload" && row.source.visibility === "private";
}

/**
 * Where a screen came from: a page of the learner's own material ("Aula 5, slide 4"), or a public
 * document its facts come from, with the date it was last checked.
 */
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

/**
 * A lesson built from the learner's material cites the page each screen came from. Citing is best
 * effort, so an explanation no page supports says it isn't in their material instead of passing
 * for something their class covered.
 */
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
