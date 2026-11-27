import { apportion } from "@zoonk/utils/apportion";
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

  const percentages = apportion({ total: 100, weights: raw });

  return subjects.map((subject, index) =>
    subject.source === "notice"
      ? {
          basis: subject.share === null ? "assumed" : "stated",
          percent: percentages[index] ?? 0,
          share: (raw[index] ?? 0) / total,
        }
      : null,
  );
}
