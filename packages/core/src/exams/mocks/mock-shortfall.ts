import { apportion } from "@zoonk/utils/apportion";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockFormat, getAreaFormat } from "./mock-format-mix";
import { type MockOption, findAreaSubject, getSubjectShares } from "./mock-options";
import {
  type MockCandidate,
  type MockPlan,
  countPlannedQuestions,
  getPlannedItemIds,
} from "./mock-plan";

export function isMockShort({
  option,
  planned,
}: {
  option: { questions: number };
  planned: number;
}): boolean {
  return planned < option.questions;
}

/** `isQuantitative` is false for a skill whose numeric questions came back empty. */
export type MockWritingSkill = { area: string | null; id: string; isQuantitative?: boolean | null };

export type MockFormatShortfall = {
  format: MockFormat;
  questionsPerSkill: number;
  skillIds: string[];
  target: number;
};

/**
 * Numbers go to a skill already answered in numbers, or, when the documents ask them in some parts
 * only, to the skills of those parts.
 */
function canWrite({
  candidates,
  format,
  skill,
}: {
  candidates: readonly MockCandidate[];
  format: MockFormat;
  skill?: MockWritingSkill;
}): boolean {
  const { writer } = format;

  if (writer.kind !== "item" || writer.answerFormat.format !== "numeric") {
    return true;
  }

  if (format.sections.length > 0) {
    return skill?.isQuantitative !== false;
  }

  if (skill?.isQuantitative === false) {
    return false;
  }

  const numeric = candidates.filter((candidate) => candidate.format?.startsWith("numeric:"));

  return (
    !skill ||
    skill.isQuantitative === true ||
    numeric.length === 0 ||
    numeric.some((candidate) => candidate.skillId === skill.id)
  );
}

type FormatCount = { format: MockFormat; needed: number; planned: number; wanted: number };

/** A format no section of this mock asks (the notice asks it on another day) needs no questions. */
function listAskedFormats({ mix, plan }: { mix: readonly MockFormat[]; plan: MockPlan }) {
  const wanted = plan.formatsWanted;
  return wanted ? mix.filter((format) => format.key in wanted) : [...mix];
}

function countFormats({
  candidates,
  mix,
  option,
  plan,
}: {
  candidates: readonly MockCandidate[];
  mix: readonly MockFormat[];
  option: { questions: number };
  plan: MockPlan;
}): FormatCount[] {
  const asked = listAskedFormats({ mix, plan });
  const weights = asked.map((format) => format.share);
  const needed = apportion({ total: option.questions, weights });
  const planned = new Set(getPlannedItemIds(plan));

  const fresh = candidates.filter(
    (candidate) => !candidate.answered && planned.has(candidate.itemId),
  );

  return asked.map((format, index) => ({
    format,
    needed: needed[index] ?? 0,
    planned: fresh.filter((candidate) => asked.length === 1 || candidate.format === format.key)
      .length,
    wanted: plan.formatsWanted?.[format.key] ?? 0,
  }));
}

export function listShortFormats(input: {
  candidates: readonly MockCandidate[];
  mix: readonly MockFormat[];
  option: { questions: number };
  plan: MockPlan;
}): MockFormat[] {
  const { candidates, mix, option, plan } = input;
  const newQuestions = countPlannedQuestions(plan) - plan.reused;
  const asked = listAskedFormats({ mix, plan });
  const writable = asked.filter((format) => canWrite({ candidates, format }));
  const fallback = isMockShort({ option, planned: newQuestions }) ? writable[0] : undefined;

  return countFormats(input)
    .filter(
      ({ format, planned, wanted }) =>
        (wanted > 0 && isMockShort({ option: { questions: wanted }, planned })) ||
        format === fallback,
    )
    .map(({ format }) => format)
    .filter((format) => writable.includes(format));
}

export function getMockQuestionsShortfall({
  candidates,
  mix,
  option,
  plan,
  skills,
  onlyMissing = false,
  structure,
}: {
  candidates: readonly MockCandidate[];
  mix: readonly MockFormat[];
  option: Pick<MockOption, "questions"> & Partial<Pick<MockOption, "kind">>;
  plan: MockPlan;
  skills: readonly MockWritingSkill[];
  onlyMissing?: boolean;
  structure: ExamStructure | null;
}): MockFormatShortfall[] {
  const shortFormats = new Set(listShortFormats({ candidates, mix, option, plan }));
  const selected = new Set(getPlannedItemIds(plan));

  const fresh = candidates.filter(
    (candidate) => !candidate.answered && selected.has(candidate.itemId),
  );

  const demand = plan.formatsWanted
    ? Object.values(plan.formatsWanted).reduce((sum, count) => sum + count, 0)
    : option.questions;

  let remaining = onlyMissing ? Math.max(0, demand - fresh.length) : Number.POSITIVE_INFINITY;

  return countFormats({ candidates, mix, option, plan }).flatMap(({ format, needed, wanted }) => {
    const eligible = skills.flatMap((skill) => {
      const own = getAreaFormat({ area: skill.area, format, structure });

      return own !== null && canWrite({ candidates, format: own, skill })
        ? [{ format: own, skill }]
        : [];
    });

    const size = plan.formatsWanted ? wanted : needed;

    if (!shortFormats.has(format) || eligible.length === 0 || size === 0) {
      return [];
    }

    const shares = getSubjectShares(structure);

    const bySubject = Map.groupBy(eligible, ({ skill }) =>
      skill.area ? (findAreaSubject({ area: skill.area, structure })?.name ?? skill.area) : "",
    );

    const subjects = [...bySubject.entries()];

    const quotas = apportion({
      total: size,
      weights: subjects.map(
        ([name, group]) => shares.find((share) => share.name === name)?.questions ?? group.length,
      ),
    });

    const writes = subjects.flatMap(([name, group], index) => {
      const notice = shares.find((share) => share.name === name)?.questions;

      const quota =
        notice && mix.length === 1 && option.kind !== "area" && !structure?.mock?.adaptive
          ? Math.min(quotas[index] ?? 0, Math.ceil(notice / (plan.fullLength ? 1 : 2)))
          : (quotas[index] ?? 0);

      const held = group.map(
        ({ skill }) =>
          fresh.filter(
            (candidate) =>
              candidate.skillId === skill.id &&
              (mix.length === 1 || candidate.format === format.key),
          ).length,
      );

      const missing = Math.min(
        remaining,
        Math.max(0, quota - held.reduce((sum, count) => sum + count, 0)),
      );

      remaining -= missing;

      if (!missing) {
        return [];
      }

      const ordered = group
        .map((entry, i) => ({ ...entry, held: held[i] ?? 0 }))
        .toSorted((first, second) => first.held - second.held);

      const counts = apportion({ total: missing, weights: ordered.map(() => 1) });

      return ordered.flatMap(({ format: own, skill, held: count }, i) => {
        const questionsPerSkill = counts[i] ?? 0;

        return questionsPerSkill
          ? [
              {
                format: own,
                questionsPerSkill,
                skillId: skill.id,
                target: count + questionsPerSkill,
              },
            ]
          : [];
      });
    });

    const groups = Map.groupBy(writes, (write) =>
      JSON.stringify([write.format.style, write.questionsPerSkill, write.target]),
    );

    return [...groups.values()].flatMap((group) =>
      group[0]
        ? [
            {
              format: group[0].format,
              questionsPerSkill: group[0].questionsPerSkill,
              skillIds: group.map((write) => write.skillId),
              target: group[0].target,
            },
          ]
        : [],
    );
  });
}
