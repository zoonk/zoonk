import { toTopicKey } from "../../../library/exams/topic-key";
import { getWorkProgress, isWorkFinished } from "../../../plans/_utils/work-progress";
import { type NotPlannedReason, type SyllabusTopic } from "../syllabus-contract";
import {
  type KeyedChapter,
  chapterKeyOf,
  getEarliestTodoDate,
  withoutKey,
} from "./syllabus-chapters";
import { type SyllabusItem, type SyllabusSkill } from "./syllabus-input";

export function getNotPlannedReason({
  hasItems,
  hasSkills,
  known = false,
  pastBasics = false,
  skipped,
  skippedBase = false,
}: {
  hasItems: boolean;
  hasSkills: boolean;
  /** Every skill that teaches it is one the learner showed they know: practice keeps it in. */
  known?: boolean;
  /** Every skill that teaches it is one of a subject's basics the plan starts past. */
  pastBasics?: boolean;
  skipped: boolean;
  /** Every skill that teaches it is a base the learner chose to skip. */
  skippedBase?: boolean;
}): NotPlannedReason | null {
  if (skipped) {
    return "skipped";
  }

  if (!hasSkills) {
    return "missing";
  }

  if (hasItems || known) {
    return null;
  }

  if (skippedBase) {
    return "skippedBase";
  }

  return pastBasics ? "pastBasics" : "time";
}

/** Set-aside lessons count as neither studied nor known. */
function getTopicStatus(items: readonly SyllabusItem[]): SyllabusTopic["status"] {
  const done = items.filter((item) => isWorkFinished(item.status)).length;

  if (items.every((item) => getWorkProgress(item.status) === "testedOut")) {
    return "known";
  }

  if (done === items.length) {
    return "studied";
  }

  return done > 0 ? "inProgress" : "toStudy";
}

function isRestSetAside(items: readonly SyllabusItem[]): boolean {
  const progress = new Set(items.map((item) => getWorkProgress(item.status)));
  return progress.has("setAside") && !progress.has("todo");
}

function findTopicSkills({ skills, topic }: { skills: readonly SyllabusSkill[]; topic: string }) {
  const wanted = toTopicKey(topic);
  return skills.filter((skill) => skill.topics.some((name) => toTopicKey(name) === wanted));
}

/** Older notice mappings may name no current topics; display those topics without claiming they are out of plan. */
export function namesAnyTopic({
  skills,
  topics,
}: {
  skills: readonly SyllabusSkill[];
  topics: readonly string[];
}): boolean {
  return topics.some((topic) => findTopicSkills({ skills, topic }).length > 0);
}

/** Claims status only for mapped topics; prefers the subject's own skills before other subjects. */
export function buildTopic({
  chapters,
  items,
  knownSkillIds,
  mapped,
  pastBasicsSkillIds,
  skills,
  skipped,
  skippedBaseIds = new Set(),
  topic,
}: {
  chapters: readonly KeyedChapter[];
  /** Fall back to all lessons only when another subject teaches the topic. */
  items: { all: readonly SyllabusItem[]; own: readonly SyllabusItem[] };
  knownSkillIds: ReadonlySet<string>;
  mapped: boolean;
  pastBasicsSkillIds: ReadonlySet<string>;
  /** Fall back to all skills only when this subject teaches none of the topic. */
  skills: { all: readonly SyllabusSkill[]; own: readonly SyllabusSkill[] };
  skipped: boolean;
  skippedBaseIds?: ReadonlySet<string>;
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

  const known = teaching.every((skill) => knownSkillIds.has(skill.skillId));

  const reason = getNotPlannedReason({
    hasItems: taught.length > 0,
    hasSkills: teaching.length > 0,
    known,
    pastBasics: teaching.every((skill) => pastBasicsSkillIds.has(skill.skillId)),
    skipped,
    skippedBase: teaching.every((skill) => skippedBaseIds.has(skill.skillId)),
  });

  const studied = taught.filter((item) => isWorkFinished(item.status));

  // Removing a subject must not erase the lessons already studied within it.
  if (reason === "skipped" && studied.length > 0) {
    return {
      ...topicChapters({ chapters, items: studied }),
      name: topic,
      nextDate: null,
      notPlannedReason: reason,
      status: getTopicStatus(studied),
    };
  }

  if (reason) {
    return { ...empty, notPlannedReason: reason, status: "notPlanned" };
  }

  // Known topics still require practice even when their lessons are skipped.
  if (taught.length === 0) {
    return { ...empty, notPlannedReason: null, status: "known" };
  }

  // Set-aside lessons leave the topic out for time while preserving studied progress.
  if (isRestSetAside(taught)) {
    return studied.length > 0
      ? {
          ...topicChapters({ chapters, items: studied }),
          name: topic,
          nextDate: null,
          notPlannedReason: "time",
          status: getTopicStatus(taught),
        }
      : { ...empty, notPlannedReason: "time", status: "notPlanned" };
  }

  return {
    ...topicChapters({ chapters, items: taught }),
    name: topic,
    nextDate: getEarliestTodoDate(taught),
    notPlannedReason: null,
    status: getTopicStatus(taught),
  };
}

function topicChapters({
  chapters,
  items,
}: {
  chapters: readonly KeyedChapter[];
  items: readonly SyllabusItem[];
}): Pick<SyllabusTopic, "chapters"> {
  const keys = new Set(items.map((item) => chapterKeyOf(item)));

  return {
    chapters: chapters
      .filter((chapter) => keys.has(chapter.key))
      .map((chapter) => withoutKey(chapter)),
  };
}

const ITEM_NUMBER = /^\s*(?<number>\d{1,3}(?:\.\d{1,3})*)\.?\s+\S/u;

function getTopicNumber(name: string): string | null {
  return ITEM_NUMBER.exec(name)?.groups?.number ?? null;
}

type BuiltTopic = ReturnType<typeof buildTopic>;

function getHeadingStatus(children: readonly BuiltTopic[]): SyllabusTopic["status"] {
  const planned = children.filter((child) => child.status !== "notPlanned");
  const isCovered = (child: BuiltTopic) => child.status === "studied" || child.status === "known";

  if (planned.every((child) => child.status === "known")) {
    return "known";
  }

  if (planned.every((child) => isCovered(child))) {
    return "studied";
  }

  return planned.some((child) => isCovered(child) || child.status === "inProgress")
    ? "inProgress"
    : "toStudy";
}

function getEarliestDate(topics: readonly BuiltTopic[]): string | null {
  return topics.flatMap((topic) => topic.nextDate ?? []).toSorted()[0] ?? null;
}

/** Unmapped headings inherit coverage from numbered descendants; headings with none planned retain their own status. */
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
