import { apportion } from "@zoonk/utils/apportion";
import { normalizeString } from "@zoonk/utils/string";
import { type BlueprintSection } from "./mock-day-sections";
import { type MockCandidate } from "./mock-plan";
import { orderNewFirst } from "./mock-reuse";
import { type AreaSections, isSectionArea } from "./mock-section-areas";
import { type SubjectShare, isSubjectArea } from "./mock-subject-shares";

export function sectionPool({
  areaSections,
  candidates,
  section,
}: {
  areaSections: AreaSections | null;
  candidates: readonly MockCandidate[];
  section: BlueprintSection;
}): MockCandidate[] {
  return orderNewFirst(
    areaSections
      ? candidates.filter((candidate) => isSectionArea({ areaSections, candidate, section }))
      : candidates,
  );
}

export function getSectionName({
  allSections,
  byArea,
  section,
}: {
  allSections: readonly BlueprintSection[];
  byArea: boolean;
  section: BlueprintSection;
}): string | null {
  return byArea || allSections.length <= 1 ? section.name : null;
}

function findShare({
  candidate,
  shares,
}: {
  candidate: MockCandidate;
  shares: readonly SubjectShare[];
}): SubjectShare | undefined {
  const area = candidate.area === null ? null : normalizeString(candidate.area);

  return (
    shares.find((share) => normalizeString(share.name) === area) ??
    shares.find((share) => isSubjectArea({ candidate, name: share.name }))
  );
}

export function orderBySubjectShares({
  pool,
  portion,
  subjectShares,
  wanted,
}: {
  pool: readonly MockCandidate[];
  portion: number;
  subjectShares: readonly SubjectShare[];
  wanted: number;
}): MockCandidate[] {
  const bySubject = Map.groupBy(
    pool,
    (candidate) => findShare({ candidate, shares: subjectShares }) ?? null,
  );

  const shares = subjectShares.filter((share) => bySubject.has(share));
  const counted = shares.length > 0 && shares.every((share) => !share.even);

  if (shares.length < 2 && !counted) {
    return [...pool];
  }

  const weights = shares.map((share) => share.questions ?? 0);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const size = counted ? Math.min(wanted, Math.round(total * portion)) : wanted;
  const quotas = apportion({ total: size, weights });

  const first = shares.flatMap((share, index) =>
    (bySubject.get(share) ?? []).slice(0, quotas[index] ?? 0),
  );

  const picked = new Set(first.map((candidate) => candidate.itemId));
  const others = bySubject.get(null) ?? [];

  return [
    ...first,
    ...(counted ? others : pool.filter((candidate) => !picked.has(candidate.itemId))),
  ];
}
