import { type GoalKind } from "@zoonk/db";
import { type SkillGroups } from "../../view-models/syllabus/_utils/load-syllabus";
import { toKeys } from "../../view-models/syllabus/_utils/syllabus-subjects";
import { type CompletedLessonFilter } from "../contract";

/** A shorter list is read whole, so it has nothing to narrow. */
const NARROWED_FROM = 10;

/**
 * The groups a goal's completed lessons narrow to, and each lesson's group key in `lessons`' order
 * (null for a lesson of none). No filter with fewer than two groups to choose between.
 */
export function groupCompletedLessons({
  goalKind,
  groups,
  lessons,
}: {
  goalKind: GoalKind;
  groups: SkillGroups | null;
  lessons: readonly { skillIds: readonly string[] }[];
}): { filter: CompletedLessonFilter | null; keys: (string | null)[] } {
  const none = { filter: null, keys: lessons.map(() => null) };

  if (!groups || lessons.length <= NARROWED_FROM) {
    return none;
  }

  const names = lessons.map(
    (lesson) => lesson.skillIds.flatMap((skillId) => groups.names.get(skillId) ?? [])[0] ?? null,
  );

  const counted = [
    ...Map.groupBy(
      names.filter((name) => name !== null),
      (name) => name,
    ),
  ]
    .map(([name, group]) => ({ lessons: group.length, name }))
    .toSorted((a, b) => b.lessons - a.lessons || a.name.localeCompare(b.name));

  if (counted.length < 2) {
    return none;
  }

  const keys = toKeys(counted.map((group) => group.name));
  const keyByName = new Map(counted.map((group, index) => [group.name, keys[index] ?? null]));
  const subjectKind = goalKind === "exam" ? "subjects" : "modules";

  return {
    filter: {
      groups: counted.map((group, index) => ({ ...group, key: keys[index] ?? group.name })),
      kind: groups.kind === "phases" ? "phases" : subjectKind,
      total: lessons.length,
    },
    keys: names.map((name) => (name === null ? null : (keyByName.get(name) ?? null))),
  };
}
