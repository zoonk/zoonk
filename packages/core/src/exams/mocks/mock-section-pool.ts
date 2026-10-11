import { apportion } from "@zoonk/utils/apportion";
import { normalizeString } from "@zoonk/utils/string";
import { type BlueprintSection } from "./mock-day-sections";
import { type MockCandidate } from "./mock-plan";
import { orderNewFirst } from "./mock-reuse";
import { type AreaSections, isSectionArea } from "./mock-section-areas";
import { type SubjectShare, isSubjectArea } from "./mock-subject-shares";

/**
 * The questions a section may ask. When areas line up with sections, only the section's own area:
 * "Natural Sciences and Math" never asks an English reading question, and a question whose area
 * no section names stays out. When they don't line up, any question may fill any section. New
 * questions come first (see `orderNewFirst`).
 */
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

/**
 * A section's name says which area it asks. Questions that couldn't be sorted by area fill an
 * exam's several sections without their names, so none claims an area it may not ask.
 */
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

/**
 * The subject a question counts toward: the one named as its area, else the first whose name
 * matches it, so a subject named inside another's ("Civil Law", "Civil Procedure Law") never
 * takes the other's questions.
 */
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

/**
 * A section that asks several of the notice's subjects asks each its share, in the notice's order,
 * as ENEM's first day asks 45 questions of Languages, then 45 of Humanities. When the notice (or a
 * past edition) counts them, each asks at most its count in the part of the exam the mock sits
 * (`portion`), so the mock keeps the exam's proportions: a subject short of questions leaves its
 * place empty. When they're split evenly for want of counts, a subject short of questions leaves
 * its place to the others. Questions whose areas aren't those subjects fill what's left.
 */
export function orderBySubjectShares({
  pool,
  portion,
  subjectShares,
  wanted,
}: {
  pool: readonly MockCandidate[];
  /** The part of the exam the mock sits: 1 in full, 0.5 for half. */
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

  // Counted subjects never ask past their count; uncounted questions fill what's left.
  return [
    ...first,
    ...(counted ? others : pool.filter((candidate) => !picked.has(candidate.itemId))),
  ];
}
