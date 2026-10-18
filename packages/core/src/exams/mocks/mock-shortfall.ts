import { apportion } from "@zoonk/utils/apportion";
import { interleave } from "@zoonk/utils/interleave";
import { type MockFormat } from "./mock-format-mix";
import {
  type MockCandidate,
  type MockPlan,
  countPlannedQuestions,
  getPlannedItemIds,
} from "./mock-plan";

/**
 * A bank this close to a mock's size starts it as it is: writing two questions isn't worth the
 * learner's wait. The mock says its real size.
 */
const NEAR_FULL_SHARE = 0.9;

/** However few skills a mock asks about, each gets at most this many new questions written. */
const MAX_QUESTIONS_PER_SKILL = 15;

/**
 * Questions in a format the item writer writes stay a few per skill: when few skills take it (a
 * number typed in), one skill's questions would otherwise fill the format's whole share, and the
 * mock asks the exam's other formats for the rest.
 */
const MAX_ITEM_QUESTIONS_PER_SKILL = 5;

/** Whether the bank's questions fall short of the option's (see `NEAR_FULL_SHARE`). */
export function isMockShort({
  option,
  planned,
}: {
  option: { questions: number };
  planned: number;
}): boolean {
  return planned < Math.ceil(option.questions * NEAR_FULL_SHARE);
}

/** A skill a mock may get questions written for, and the area that puts it in a section. */
export type MockWritingSkill = { area: string | null; id: string };

/**
 * Questions to write in one of the exam's formats before a mock starts: `questionsPerSkill` more
 * for each of `skillIds`, what they lack of the `target` each should hold, shared with every later
 * learner of the exam.
 */
export type MockFormatShortfall = {
  format: MockFormat;
  questionsPerSkill: number;
  skillIds: string[];
  target: number;
};

/**
 * Whether the format's questions can be written for a skill: never typed words (`bankOnly`), and
 * a number typed in only for a skill the bank already asks numbers about (a calculation), as
 * `pickExamFormatSkills` writes them. Without `skillId`, for any skill.
 */
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

type FormatCount = {
  format: MockFormat;
  /** Its share of the option's questions, the size questions are written to. */
  needed: number;
  /** The questions the plan asks in it that the learner never answered. */
  planned: number;
  /** The questions the plan's sections want in it (`MockPlan.formatsWanted`). */
  wanted: number;
};

/** Each format of the mix with what the mock asks in it and has for it. */
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
    // An exam of one format asks every question it may in it.
    planned: fresh.filter((candidate) => mix.length === 1 || candidate.format === format.key)
      .length,
    wanted: plan.formatsWanted?.[format.key] ?? 0,
  }));
}

/**
 * The mix's formats a mock is short of: the questions it plans in each that the learner never
 * answered fall short of what its sections want in it (`isMockShort`), and some skill can take
 * questions written in it (`canWrite`); and the first one that can be written when the whole
 * mock is short of new questions (an adaptive exam's routed modules). Empty when the bank holds
 * them all.
 */
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

/**
 * What to write before a mock can start, format by format (see `listShortFormats`): each format's
 * share of the mock spread over the skills that can take it, a few each (`target`), so it takes
 * as many skills holding that many questions the learner never answered as the share needs.
 * Skills that already hold theirs count; the ones short of it get what they lack written, spread
 * over the mock's areas so every section gets its share. Empty when the bank holds the mock's
 * questions.
 */
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
  /** The plan's skills the mock asks about, which questions are written for. */
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

    // Only what each skill lacks is written: skills lacking as many share one write.
    const byLack = Map.groupBy(written, (skill) => target - holds(skill));

    return [...byLack].map(([questionsPerSkill, lacking]) => ({
      format,
      questionsPerSkill,
      skillIds: lacking.map((skill) => skill.id),
      target,
    }));
  });
}
