import { normalizeString } from "@zoonk/utils/string";
import { namesMatch } from "../../exams/_utils/name-match";
import { type BlueprintContent } from "./blueprint-contract";

type Subject = BlueprintContent["structure"]["subjects"][number];

function isSameName(first: string, second: string): boolean {
  return normalizeString(first) === normalizeString(second);
}

/**
 * The one of `candidates` a name means: the one of the same name, or else the only one its words
 * match, unless another of `rivals` matches it too ("Direito Civil" isn't "Direito Processual Civil").
 */
function findNamed<T extends { name: string }>({
  candidates,
  name,
  rivals,
}: {
  candidates: readonly T[];
  name: string;
  rivals: readonly string[];
}): T | undefined {
  const exact = candidates.find((candidate) => isSameName(candidate.name, name));

  if (exact) {
    return exact;
  }

  const [only, ...others] = candidates.filter((candidate) => namesMatch(candidate.name, name));

  const isClaimed = (candidate: T) =>
    rivals.some((rival) => !isSameName(rival, name) && namesMatch(candidate.name, rival));

  return only && others.length === 0 && !isClaimed(only) ? only : undefined;
}

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
  const readNames = next.structure.subjects.map((subject) => subject.name);
  const storedNames = stored.structure.subjects.map((subject) => subject.name);

  const findStored = (name: string) =>
    findNamed({ candidates: stored.structure.subjects, name, rivals: readNames });

  const countNames = problems.flatMap((problem) =>
    problem.kind === "missingCount" ? [problem.subject] : [],
  );

  const uncounted = new Set(
    countNames.flatMap((name) => {
      const subject = findNamed({ candidates: next.structure.subjects, name, rivals: countNames });
      return subject ? [subject] : [];
    }),
  );

  const subjects = next.structure.subjects.map((subject): Subject => {
    const questions = uncounted.has(subject) ? findStored(subject.name)?.questions : null;
    return questions === null || questions === undefined ? subject : { ...subject, questions };
  });

  const missed = problems.flatMap((problem) => {
    const known = problem.kind === "missingSubject" ? findStored(problem.name) : undefined;
    return known ? [known] : [];
  });

  const kept = missed.filter(
    (subject, index) =>
      missed.indexOf(subject) === index &&
      !findNamed({ candidates: subjects, name: subject.name, rivals: storedNames }),
  );

  return { ...next, structure: { ...next.structure, subjects: [...subjects, ...kept] } };
}
