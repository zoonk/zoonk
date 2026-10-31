import { type DiffTone } from "../_components/diff-lines";

/**
 * Against a date, lessons left out are bad news; without one, fewer lessons is good news and more
 * is a plain change.
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
