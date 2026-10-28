import { namesMatch } from "../_utils/name-match";
import { type MockCandidate } from "./mock-plan";

export type SubjectShare = {
  even?: boolean;
  name: string;
  partOf?: string | null;
  questions: number | null;
};

type CountedShare = Omit<SubjectShare, "questions"> & { questions: number };

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

export function getPartOfAreas(shares: readonly SubjectShare[]): ReadonlyMap<string, string> {
  return new Map(
    shares.flatMap((share): [string, string][] =>
      share.partOf ? [[share.name, share.partOf]] : [],
    ),
  );
}
