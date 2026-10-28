import { apportion } from "@zoonk/utils/apportion";
import { interleave } from "@zoonk/utils/interleave";
import { type MockFormat } from "./mock-format-mix";
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

export type MockWritingSkill = { area: string | null; id: string };

export type MockFormatShortfall = {
  format: MockFormat;
  questionsPerSkill: number;
  skillIds: string[];
  target: number;
};

function canWrite({
  candidates,
  format,
  skillId,
}: {
  candidates: readonly MockCandidate[];
  format: MockFormat;
  skillId?: string;
}): boolean {
  const { writer } = format;

  if (writer.kind !== "item" || writer.answerFormat.format !== "numeric") {
    return writer.kind !== "bankOnly";
  }

  return candidates.some(
    (candidate) =>
      (skillId === undefined || candidate.skillId === skillId) &&
      candidate.format?.startsWith("numeric:"),
  );
}

type FormatCount = { format: MockFormat; needed: number; planned: number; wanted: number };

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
  const needed = apportion({ total: option.questions, weights: mix.map((format) => format.share) });
  const planned = new Set(getPlannedItemIds(plan));

  const fresh = candidates.filter(
    (candidate) => !candidate.answered && planned.has(candidate.itemId),
  );

  return mix.map((format, index) => ({
    format,
    needed: needed[index] ?? 0,
    planned: fresh.filter((candidate) => mix.length === 1 || candidate.format === format.key)
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
  const writable = mix.filter((format) => canWrite({ candidates, format }));
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
}: {
  candidates: readonly MockCandidate[];
  mix: readonly MockFormat[];
  option: { questions: number };
  plan: MockPlan;
  skills: readonly MockWritingSkill[];
}): MockFormatShortfall[] {
  const shortFormats = new Set(listShortFormats({ candidates, mix, option, plan }));
  const fresh = candidates.filter((candidate) => !candidate.answered);

  return countFormats({ candidates, mix, option, plan }).flatMap(({ format, needed, wanted }) => {
    const eligible = skills.filter((skill) => canWrite({ candidates, format, skillId: skill.id }));
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

    const holders = eligible.filter((skill) => holds(skill) >= target).length;
    const room = Math.ceil(size / target) - holders;

    const byArea = Map.groupBy(
      eligible.filter((skill) => holds(skill) < target),
      (skill) => skill.area,
    );

    const written = interleave([...byArea.values()]).slice(0, Math.max(0, room));

    const byLack = Map.groupBy(written, (skill) => target - holds(skill));

    return [...byLack].map(([questionsPerSkill, lacking]) => ({
      format,
      questionsPerSkill,
      skillIds: lacking.map((skill) => skill.id),
      target,
    }));
  });
}
