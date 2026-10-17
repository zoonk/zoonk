import { namesMatch } from "../_utils/name-match";
import { type MockCandidate } from "./mock-plan";

/**
 * A notice subject's share of an exam day's questions, under the name its questions' areas carry.
 * `partOf` names the subject whose count includes this one's, as ENEM's 45 Languages questions
 * include the foreign language the learner picked: its questions sit in that subject's sections.
 * `questions` is null for such an option the notice gives no count of its own (see
 * `splitPartShares`). `even` marks an even split standing in for counts the notice doesn't give.
 */
export type SubjectShare = {
  even?: boolean;
  name: string;
  partOf?: string | null;
  questions: number | null;
};

type CountedShare = Omit<SubjectShare, "questions"> & { questions: number };

/** Whether a question's area is the subject's, as sections and shares match them. */
export function isSubjectArea({ candidate, name }: { candidate: MockCandidate; name: string }) {
  return candidate.area !== null && namesMatch(candidate.area, name);
}

function countSkills({
  candidates,
  name,
}: {
  candidates: readonly MockCandidate[];
  name: string;
}): number {
  const own = candidates.filter((candidate) => isSubjectArea({ candidate, name }));
  return new Set(own.map((candidate) => candidate.skillId)).size;
}

/**
 * Every share with its questions. An option counted inside another subject that the notice gives
 * no count of its own takes its part of that subject's questions by topics: as many as its topics
 * are of both in the questions the mock may ask, and that subject keeps the rest.
 */
export function splitPartShares({
  candidates,
  shares,
}: {
  candidates: readonly MockCandidate[];
  shares: readonly SubjectShare[];
}): CountedShare[] {
  const parts = shares.flatMap((share): CountedShare[] => {
    if (share.questions !== null || !share.partOf) {
      return [];
    }

    const whole = shares.find((other) => other.name === share.partOf)?.questions ?? 0;
    const own = countSkills({ candidates, name: share.name });
    const theirs = countSkills({ candidates, name: share.partOf });
    const questions = own + theirs > 0 ? (whole * own) / (own + theirs) : 0;

    return [{ name: share.name, partOf: share.partOf, questions }];
  });

  return shares.flatMap((share): CountedShare[] => {
    if (share.questions === null) {
      return parts.filter((part) => part.name === share.name);
    }

    const carved = parts
      .filter((part) => part.partOf === share.name)
      .reduce((sum, part) => sum + part.questions, 0);

    return [{ ...share, questions: share.questions - carved }];
  });
}

/** The subject whose sections ask each option's questions, by the option's area (`partOf`). */
export function getPartOfAreas(shares: readonly SubjectShare[]): ReadonlyMap<string, string> {
  return new Map(
    shares.flatMap((share): [string, string][] =>
      share.partOf ? [[share.name, share.partOf]] : [],
    ),
  );
}
