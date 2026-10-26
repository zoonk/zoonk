import { type DiffTone } from "../_components/diff-lines";

/**
 * What a plan change's lesson line means for the learner, the one line of a plan diff that carries
 * color. Against a date (`byDate`), lessons left out are bad news (the date leaves no time for
 * them) and lessons added back are good news. Without one the plan keeps every lesson, so fewer is
 * good news (less to study for the same goal) and more is a plain change, never blue. Every other
 * line (a date, an end, a count that moves) is neutral.
 */
export function getLessonLineTone({
  byDate,
  kind,
}: {
  byDate: boolean;
  kind: "added" | "removed";
}): DiffTone {
  if (byDate) {
    return kind === "removed" ? "bad" : "good";
  }

  return kind === "removed" ? "good" : "neutral";
}
