import { type ItemFormat } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { interleave } from "@zoonk/utils/interleave";

/**
 * Time capsules are the review block: the key ideas of a finished lesson are sealed with an opening
 * date from FSRS, and on that day they open with a few quick questions in the format that fits.
 * Rapid-fire serves quick choice questions and math problems (with new numbers each time), match
 * pairs one matching question, and swipe serves true-or-false statements with net scoring for exams
 * where a wrong answer cancels a right one.
 */
export const CAPSULE_FORMATS = ["rapidFire", "matchPairs", "swipe"] as const;

export type CapsuleFormat = (typeof CAPSULE_FORMATS)[number];

/** "Answer 3 quick questions and the cards glow again." */
const CAPSULE_QUESTIONS = 3;

/** A skill due for review today, with the lesson that taught it (its capsule). */
export type DueSkill = { lessonId: string | null; skillId: string; title: string };

export type CapsuleGroup = {
  key: string;
  lessonId: string | null;
  skillIds: string[];
  title: string;
};

/** A question the capsule could ask, with when the learner last answered it. */
export type CapsuleItemCandidate = {
  format: ItemFormat;
  id: string;
  /** Set in the learner's field (work and career goals): asked before general questions. */
  inField?: boolean;
  lastAnsweredAt: Date | null;
  skillId: string;
};

const RAPID_FIRE_FORMATS = new Set<ItemFormat>(["multipleChoice", "trueFalse", "numeric"]);

function getCapsuleKey(skill: DueSkill): string {
  return skill.lessonId ?? `skill:${skill.skillId}`;
}

/**
 * Groups today's due skills into capsules, one per lesson that taught them (a skill without a
 * lesson is its own capsule). Capsules keep the order of their most urgent skill.
 */
export function groupIntoCapsules(skills: readonly DueSkill[]): CapsuleGroup[] {
  const keys = [...new Set(skills.map((skill) => getCapsuleKey(skill)))];

  return keys.map((key) => {
    const members = skills.filter((skill) => getCapsuleKey(skill) === key);
    const first = members[0];

    return {
      key,
      lessonId: first?.lessonId ?? null,
      skillIds: members.map((skill) => skill.skillId),
      title: first?.title ?? "",
    };
  });
}

export function pickCapsuleFormat({
  formats,
  netScoring,
}: {
  formats: readonly ItemFormat[];
  netScoring: boolean;
}): CapsuleFormat {
  if (netScoring && formats.includes("trueFalse")) {
    return "swipe";
  }

  return formats.includes("matchPairs") ? "matchPairs" : "rapidFire";
}

function isFormatFor({ format, item }: { format: CapsuleFormat; item: CapsuleItemCandidate }) {
  if (format === "swipe") {
    return item.format === "trueFalse";
  }

  if (format === "matchPairs") {
    return item.format === "matchPairs";
  }

  return RAPID_FIRE_FORMATS.has(item.format);
}

/** Questions in the learner's field first, then never answered, then answered longest ago. */
function byLeastRecent(a: CapsuleItemCandidate, b: CapsuleItemCandidate): number {
  return (
    Number(!a.inField) - Number(!b.inField) ||
    (a.lastAnsweredAt?.getTime() ?? 0) - (b.lastAnsweredAt?.getTime() ?? 0)
  );
}

/**
 * Picks a capsule's questions: one matching question for match pairs, otherwise up to three,
 * taking one per skill in turn so every idea in the capsule comes back.
 */
export function pickCapsuleItems({
  candidates,
  format,
  skillIds,
}: {
  candidates: readonly CapsuleItemCandidate[];
  format: CapsuleFormat;
  skillIds: readonly string[];
}): string[] {
  const usable = candidates.filter((item) => isFormatFor({ format, item })).toSorted(byLeastRecent);
  const size = format === "matchPairs" ? 1 : CAPSULE_QUESTIONS;
  const perSkill = skillIds.map((skillId) => usable.filter((item) => item.skillId === skillId));

  return interleave(perSkill)
    .slice(0, size)
    .map((item) => item.id);
}

/**
 * When a lesson's capsule opens: the first day FSRS says one of its ideas is due, right when the
 * learner would start to forget. Null until one of its skills has been answered.
 */
export function getCapsuleOpening(skills: readonly { due: Date | null }[]): Date | null {
  const dues = skills.flatMap((skill) => (skill.due ? [skill.due.getTime()] : []));
  return dues.length > 0 ? new Date(Math.min(...dues)) : null;
}

/**
 * The day an idea comes back for review as the learner reads it: an idea already due comes back at
 * the next session (tomorrow), never on a day that passed, and never on or after the goal's date,
 * where the plan ends (an exam's final stretch reviews what would fade by then), so the last day
 * before it. Null when that leaves no day after today. Days are UTC-midnight labels.
 */
export function capReviewDay({
  day,
  targetDate,
  today,
}: {
  day: Date;
  targetDate: Date | null;
  today: Date;
}): Date | null {
  const tomorrow = today.getTime() + MS_PER_DAY;
  const next = new Date(Math.max(day.getTime(), tomorrow));

  if (!targetDate) {
    return next;
  }

  const lastDay = targetDate.getTime() - MS_PER_DAY;

  if (next.getTime() <= lastDay) {
    return next;
  }

  return lastDay >= tomorrow ? new Date(lastDay) : null;
}
