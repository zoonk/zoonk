import { MATCH_SIDE_TARGET } from "@zoonk/ai/tasks/items/schemas";
import { type ItemFormat } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { interleave } from "@zoonk/utils/interleave";
import { isJsonObject } from "@zoonk/utils/json";
import { segmentWords } from "@zoonk/utils/string";

/** Swipe capsules use net scoring for exams where wrong answers cancel right ones. */
export const CAPSULE_FORMATS = ["rapidFire", "matchPairs", "swipe"] as const;

export type CapsuleFormat = (typeof CAPSULE_FORMATS)[number];

const CAPSULE_QUESTIONS = 3;
const MATCH_LABEL_HEADROOM = 1.25;
const MAX_MATCH_LABEL_LENGTH = Math.ceil(MATCH_SIDE_TARGET * MATCH_LABEL_HEADROOM);
const MAX_MATCH_LABEL_WORDS = 5;
const MAX_LIGHT_MATCH_PAIRS = 5;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export type DueSkill = { lessonId: string | null; skillId: string; title: string };

export type CapsuleGroup = {
  key: string;
  lessonId: string | null;
  skillIds: string[];
  title: string;
};

export type CapsuleItemCandidate = {
  content: unknown;
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

function isShortMatchLabel(label: unknown): boolean {
  if (typeof label !== "string") {
    return false;
  }

  const text = label.trim();

  return (
    Boolean(text) &&
    [...GRAPHEMES.segment(text)].length <= MAX_MATCH_LABEL_LENGTH &&
    segmentWords(text).length <= MAX_MATCH_LABEL_WORDS
  );
}

/** A quick review board has at most five pairs of labels that fit a phone's half column. @internal */
export function isLightMatch(content: unknown): boolean {
  return (
    isJsonObject(content) &&
    Array.isArray(content.pairs) &&
    content.pairs.length >= 2 &&
    content.pairs.length <= MAX_LIGHT_MATCH_PAIRS &&
    content.pairs.every(
      (pair) => isJsonObject(pair) && isShortMatchLabel(pair.left) && isShortMatchLabel(pair.right),
    )
  );
}

function byLeastRecent(a: CapsuleItemCandidate, b: CapsuleItemCandidate): number {
  return (
    Number(!a.inField) - Number(!b.inField) ||
    (a.lastAnsweredAt?.getTime() ?? 0) - (b.lastAnsweredAt?.getTime() ?? 0)
  );
}

/** Start with the least recent eligible question, then take one per skill in turn. */
export function pickCapsuleItems({
  candidates,
  netScoring,
  skillIds,
}: {
  candidates: readonly CapsuleItemCandidate[];
  netScoring: boolean;
  skillIds: readonly string[];
}): { format: CapsuleFormat; itemIds: string[] } {
  const ordered = candidates
    .filter((item) => skillIds.includes(item.skillId))
    .toSorted(byLeastRecent);

  const firstStatement = netScoring ? ordered.find((item) => item.format === "trueFalse") : null;

  const first =
    firstStatement ??
    ordered.find((item) =>
      item.format === "matchPairs"
        ? isLightMatch(item.content)
        : RAPID_FIRE_FORMATS.has(item.format),
    ) ??
    ordered.find((item) => item.format === "matchPairs");

  if (!first) {
    return { format: "rapidFire", itemIds: [] };
  }

  if (first.format === "matchPairs") {
    return { format: "matchPairs", itemIds: [first.id] };
  }

  const usable = ordered.filter((item) =>
    firstStatement ? item.format === "trueFalse" : RAPID_FIRE_FORMATS.has(item.format),
  );

  const orderedSkills = [first.skillId, ...skillIds.filter((skillId) => skillId !== first.skillId)];

  const perSkill = orderedSkills.map((skillId) =>
    usable.filter((item) => item.skillId === skillId),
  );

  return {
    format: firstStatement ? "swipe" : "rapidFire",
    itemIds: interleave(perSkill)
      .slice(0, CAPSULE_QUESTIONS)
      .map((item) => item.id),
  };
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
