import { getSubjectShareFallback } from "../../../exams/_utils/subject-share-fallback";
import { type SyllabusSubject } from "../syllabus-contract";

/** All notice subjects count; rounding allocates the remaining points in stable notice order. */
export function getDisplayWeights(
  subjects: readonly Pick<SyllabusSubject, "share" | "source">[],
): SyllabusSubject["displayWeight"][] {
  const fallback = getSubjectShareFallback(
    subjects.filter((subject) => subject.source === "notice").map((subject) => subject.share),
  );

  const raw = subjects.map((subject) =>
    subject.source === "notice" ? (subject.share ?? fallback) : 0,
  );

  const total = raw.reduce((sum, share) => sum + share, 0);

  if (total <= 0) {
    return subjects.map(() => null);
  }

  const exact = raw.map((share) => (share * 100) / total);
  const whole = exact.map((percent) => Math.floor(percent));
  const remaining = 100 - whole.reduce((sum, percent) => sum + percent, 0);

  const order = exact
    .map((percent, index) => ({ index, remainder: percent - (whole[index] ?? 0) }))
    .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index);

  const raised = new Set(order.slice(0, remaining).map((entry) => entry.index));

  return subjects.map((subject, index) =>
    subject.source === "notice"
      ? {
          basis: subject.share === null ? "assumed" : "stated",
          percent: (whole[index] ?? 0) + (raised.has(index) ? 1 : 0),
          share: (raw[index] ?? 0) / total,
        }
      : null,
  );
}
