import { apportion } from "@zoonk/utils/apportion";
import { interleave } from "@zoonk/utils/interleave";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { listSubjectNames } from "../../library/exams/subject-names";
import { type MockFormat, getMockWritingFormat } from "./mock-format-mix";
import {
  type MockCandidate,
  type MockPlan,
  countPlannedQuestions,
  getPlannedItemIds,
} from "./mock-plan";

/** Avoid making learners wait for generation when only a few questions are missing. */
const NEAR_FULL_SHARE = 0.9;

const MAX_QUESTIONS_PER_SKILL = 15;

const MAX_ITEM_QUESTIONS_PER_SKILL = 5;

export function isMockShort({
  option,
  planned,
}: {
  option: { questions: number };
  planned: number;
}): boolean {
  return planned < Math.ceil(option.questions * NEAR_FULL_SHARE);
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
    return writer.kind !== "bankOnly";
  }

  if (format.sections.length > 0) {
    return skill?.isQuantitative !== false;
  }

  return candidates.some(
    (candidate) =>
      (skill === undefined || candidate.skillId === skill.id) &&
      candidate.format?.startsWith("numeric:"),
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
  structure,
}: {
  candidates: readonly MockCandidate[];
  mix: readonly MockFormat[];
  option: { questions: number };
  plan: MockPlan;
  skills: readonly MockWritingSkill[];
  structure: ExamStructure | null;
}): MockFormatShortfall[] {
  const allNames = skills.flatMap((skill) =>
    skill.area ? listSubjectNames({ area: skill.area, structure }) : [],
  );

  const shortFormats = new Set(listShortFormats({ candidates, mix, option, plan }));
  const fresh = candidates.filter((candidate) => !candidate.answered);

  return countFormats({ candidates, mix, option, plan }).flatMap(({ format, needed, wanted }) => {
    const eligible = skills.flatMap((skill) => {
      const own = getMockWritingFormat({
        allNames,
        format,
        names: skill.area ? listSubjectNames({ area: skill.area, structure }) : [],
        structure,
      });

      return own !== null && canWrite({ candidates, format: own, skill })
        ? [{ format: own, skill }]
        : [];
    });

    const size = Math.max(needed, wanted);

    if (!shortFormats.has(format) || eligible.length === 0 || size === 0) {
      return [];
    }

    const cap =
      format.writer.kind === "item" ? MAX_ITEM_QUESTIONS_PER_SKILL : MAX_QUESTIONS_PER_SKILL;

    const target = Math.min(cap, Math.ceil(size / eligible.length));

    const holds = (skill: MockWritingSkill) =>
      fresh.filter(
        (candidate) =>
          candidate.skillId === skill.id && (mix.length === 1 || candidate.format === format.key),
      ).length;

    const holders = eligible.filter(({ skill }) => holds(skill) >= target).length;
    const room = Math.ceil(size / target) - holders;

    const byArea = Map.groupBy(
      eligible.filter(({ skill }) => holds(skill) < target),
      ({ skill }) => skill.area,
    );

    const written = interleave([...byArea.values()]).slice(0, Math.max(0, room));

    const scoped = written.map(({ format: own, skill }) => ({
      format: own,
      questionsPerSkill: target - holds(skill),
      skill,
    }));

    const byLack = scoped.reduce((groups, { format: own, questionsPerSkill, skill }) => {
      const key = JSON.stringify([questionsPerSkill, own.style]);
      const previous = groups.get(key);

      groups.set(key, {
        format: own,
        questionsPerSkill,
        skillIds: [...(previous?.skillIds ?? []), skill.id],
        target,
      });

      return groups;
    }, new Map<string, MockFormatShortfall>());

    return [...byLack.values()];
  });
}
