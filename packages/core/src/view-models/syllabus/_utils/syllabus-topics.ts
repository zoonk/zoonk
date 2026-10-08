import { toTopicKey } from "../../../library/exams/topic-key";
import { type NotPlannedReason, type SyllabusTopic } from "../syllabus-contract";
import {
  type ChapterKeyOf,
  type KeyedChapter,
  getEarliestTodoDate,
  isFinished,
  withoutKey,
} from "./syllabus-chapters";
import { type SyllabusItem, type SyllabusSkill } from "./syllabus-input";

/**
 * Why something isn't in the plan: taken out, nothing teaches it, the plan starts past it, or it
 * didn't fit in time.
 */
export function getNotPlannedReason({
  hasItems,
  hasSkills,
  pastBasics = false,
  skipped,
}: {
  hasItems: boolean;
  hasSkills: boolean;
  /** Every skill that teaches it is one of a subject's basics the plan starts past. */
  pastBasics?: boolean;
  skipped: boolean;
}): NotPlannedReason | null {
  if (skipped) {
    return "skipped";
  }

  if (!hasSkills) {
    return "missing";
  }

  if (hasItems) {
    return null;
  }

  return pastBasics ? "pastBasics" : "time";
}

function getTopicStatus(items: readonly SyllabusItem[]): SyllabusTopic["status"] {
  const done = items.filter((item) => isFinished(item.status)).length;

  if (done === items.length) {
    return "studied";
  }

  return done > 0 ? "inProgress" : "toStudy";
}

/** The skills that teach a topic, by the topic's exact words or the same words written otherwise. */
function findTopicSkills({ skills, topic }: { skills: readonly SyllabusSkill[]; topic: string }) {
  const wanted = toTopicKey(topic);
  return skills.filter((skill) => skill.topics.some((name) => toTopicKey(name) === wanted));
}

/**
 * Whether the plan's skills name any of a subject's topics as the notice lists them now. A plan
 * built from an earlier reading whose topics were different (ENEM's matrix statements, now its
 * contents) names none: its topics are shown without a status rather than all "not in the plan".
 */
export function namesAnyTopic({
  skills,
  topics,
}: {
  skills: readonly SyllabusSkill[];
  topics: readonly string[];
}): boolean {
  return topics.some((topic) => findTopicSkills({ skills, topic }).length > 0);
}

/**
 * A notice topic with its status from the lessons of the skills that teach it (the subject's own,
 * else any), when the plan says which skills teach which topic; otherwise the topic alone.
 */
export function buildTopic({
  chapterKeyOf,
  chapters,
  items,
  mapped,
  pastBasicsSkillIds,
  skills,
  skipped,
  topic,
}: {
  chapterKeyOf: ChapterKeyOf;
  chapters: readonly KeyedChapter[];
  /** The subject's lessons, then every lesson for a topic only another subject's skills teach. */
  items: { all: readonly SyllabusItem[]; own: readonly SyllabusItem[] };
  mapped: boolean;
  /** Skills the plan starts past (see `SyllabusInput`). */
  pastBasicsSkillIds: ReadonlySet<string>;
  /** The subject's skills, then every skill when none of them teaches it. */
  skills: { all: readonly SyllabusSkill[]; own: readonly SyllabusSkill[] };
  skipped: boolean;
  topic: string;
}): Omit<SyllabusTopic, "frequency" | "heading"> {
  const empty = { chapters: [], name: topic, nextDate: null };

  if (!mapped) {
    return { ...empty, notPlannedReason: null, status: null };
  }

  const own = findTopicSkills({ skills: skills.own, topic });
  const teaching = own.length > 0 ? own : findTopicSkills({ skills: skills.all, topic });
  const skillIds = new Set(teaching.map((skill) => skill.skillId));
  const lessons = own.length > 0 ? items.own : items.all;
  const taught = lessons.filter((item) => item.skillId && skillIds.has(item.skillId));

  const reason = getNotPlannedReason({
    hasItems: taught.length > 0,
    hasSkills: teaching.length > 0,
    pastBasics: teaching.every((skill) => pastBasicsSkillIds.has(skill.skillId)),
    skipped,
  });

  if (reason) {
    return { ...empty, notPlannedReason: reason, status: "notPlanned" };
  }

  const keys = new Set(taught.map((item) => chapterKeyOf(item)));

  return {
    chapters: chapters
      .filter((chapter) => keys.has(chapter.key))
      .map((chapter) => withoutKey(chapter)),
    name: topic,
    nextDate: getEarliestTodoDate(taught),
    notPlannedReason: null,
    status: getTopicStatus(taught),
  };
}

/** A syllabus item's own number ("2", "2.1"), which a notice writes before its words. */
const ITEM_NUMBER = /^\s*(?<number>\d{1,3}(?:\.\d{1,3})*)\.?\s+\S/u;

function getTopicNumber(name: string): string | null {
  return ITEM_NUMBER.exec(name)?.groups?.number ?? null;
}

type BuiltTopic = ReturnType<typeof buildTopic>;

/** A heading's status from the items numbered under it that the plan has. */
function getHeadingStatus(children: readonly BuiltTopic[]): SyllabusTopic["status"] {
  const planned = children.filter((child) => child.status !== "notPlanned");

  if (planned.every((child) => child.status === "studied")) {
    return "studied";
  }

  return planned.some((child) => child.status === "studied" || child.status === "inProgress")
    ? "inProgress"
    : "toStudy";
}

/** The earliest date among these topics', or null. */
function getEarliestDate(topics: readonly BuiltTopic[]): string | null {
  return topics.flatMap((topic) => topic.nextDate ?? []).toSorted()[0] ?? null;
}

/**
 * A heading of the notice's outline ("2 Ato administrativo" over "2.1", "2.2"…) that no skill
 * names takes its status from the items numbered under it: it's in the plan when any of them is,
 * so the topic sheet never says "out of your plan" over items the plan teaches. A heading none of
 * whose items is in the plan keeps its own status.
 */
export function withHeadingStatuses<TTopic extends BuiltTopic>(
  topics: readonly TTopic[],
): TTopic[] {
  const numbers = topics.map((topic) => getTopicNumber(topic.name));

  return topics.map((topic, index) => {
    const number = numbers[index];

    if (!number || topic.notPlannedReason !== "missing") {
      return topic;
    }

    const children = topics.filter((_, other) => numbers[other]?.startsWith(`${number}.`));

    if (!children.some((child) => child.status !== "notPlanned")) {
      return topic;
    }

    return {
      ...topic,
      nextDate: getEarliestDate(children),
      notPlannedReason: null,
      status: getHeadingStatus(children),
    };
  });
}
