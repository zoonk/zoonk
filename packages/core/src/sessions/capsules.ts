import { type ItemFormat } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { interleave } from "@zoonk/utils/interleave";

/** Swipe capsules use net scoring for exams where wrong answers cancel right ones. */
export const CAPSULE_FORMATS = ["rapidFire", "matchPairs", "swipe"] as const;

export type CapsuleFormat = (typeof CAPSULE_FORMATS)[number];

const CAPSULE_QUESTIONS = 3;

export type DueSkill = { lessonId: string | null; skillId: string; title: string };

export type CapsuleGroup = {
  key: string;
  lessonId: string | null;
  skillIds: string[];
  title: string;
};

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

/** Keep capsules in urgency order; a skill without a teaching lesson gets its own capsule. */
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

function byLeastRecent(a: CapsuleItemCandidate, b: CapsuleItemCandidate): number {
  return (
    Number(!a.inField) - Number(!b.inField) ||
    (a.lastAnsweredAt?.getTime() ?? 0) - (b.lastAnsweredAt?.getTime() ?? 0)
  );
}

/** Takes one question per skill in turn; matching capsules ask one item, other formats up to three. */
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

/** Returns the earliest skill due date, or null until any skill has been answered. */
export function getCapsuleOpening(skills: readonly { due: Date | null }[]): Date | null {
  const dues = skills.flatMap((skill) => (skill.due ? [skill.due.getTime()] : []));
  return dues.length > 0 ? new Date(Math.min(...dues)) : null;
}

/** Accepts UTC-midnight day labels; past-due reviews move to tomorrow and reviews on/after the goal's date return null. */
export function capReviewDay({
  day,
  targetDate,
  today,
}: {
  day: Date;
  targetDate: Date | null;
  today: Date;
}): Date | null {
  const next = new Date(Math.max(day.getTime(), today.getTime() + MS_PER_DAY));
  return !targetDate || next < targetDate ? next : null;
}

/** Always includes the first capsule even if it exceeds maxQuestions. */
function takeCapsules<T extends { itemIds: readonly string[] }>({
  capsules,
  maxQuestions,
}: {
  capsules: readonly T[];
  maxQuestions: number;
}): T[] {
  return capsules.filter((_, index) => {
    const questions = capsules
      .slice(0, index + 1)
      .reduce((sum, capsule) => sum + capsule.itemIds.length, 0);

    return index === 0 || questions <= maxQuestions;
  });
}

/** maxQuestions permits at least one capsule, but room is a hard limit that may exclude even the first. */
export function takeReviewCapsules<T extends { itemIds: readonly string[] }>({
  capsules,
  maxQuestions = Number.POSITIVE_INFINITY,
  room,
}: {
  capsules: readonly T[];
  maxQuestions?: number;
  room: number;
}): T[] {
  const first = capsules[0];

  if (!first || first.itemIds.length > room) {
    return [];
  }

  return takeCapsules({ capsules, maxQuestions: Math.min(maxQuestions, room) });
}
