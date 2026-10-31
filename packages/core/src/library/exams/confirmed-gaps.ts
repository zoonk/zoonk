import { namesMatch } from "../../exams/_utils/name-match";
import { type BlueprintContent } from "./blueprint-contract";

type Subject = BlueprintContent["structure"]["subjects"][number];

/**
 * A reading takes over, except for the subjects and counts its check confirms it missed, which the
 * stored reading keeps: a false finding keeps at most one stale subject until the next reading.
 */
export function carryConfirmedGaps({
  next,
  stored,
}: {
  next: BlueprintContent;
  stored: BlueprintContent;
}): BlueprintContent {
  const problems = next.edition.check?.problems ?? [];

  const findStored = (name: string) =>
    stored.structure.subjects.find((subject) => namesMatch(subject.name, name));

  const subjects = next.structure.subjects.map((subject): Subject => {
    const isMissingCount = problems.some(
      (problem) => problem.kind === "missingCount" && namesMatch(problem.subject, subject.name),
    );

    const questions = isMissingCount ? findStored(subject.name)?.questions : null;

    return questions === null || questions === undefined ? subject : { ...subject, questions };
  });

  const missed = problems.flatMap((problem) => {
    const known = problem.kind === "missingSubject" ? findStored(problem.name) : undefined;
    return known ? [known] : [];
  });

  const kept = missed.filter(
    (subject, index) =>
      missed.indexOf(subject) === index &&
      !subjects.some((other) => namesMatch(other.name, subject.name)),
  );

  return { ...next, structure: { ...next.structure, subjects: [...subjects, ...kept] } };
}
