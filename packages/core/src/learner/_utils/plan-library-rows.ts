import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import {
  type LessonSkillRow,
  getChapterTitleRows,
  getLessonHomeChapterRows,
  getLessonSkillRows,
  getSkillLevelRows,
  getSkillPrerequisiteRows,
  toIdKey,
} from "../../library/_utils/shared-rows";
import { type ItemSkillRows } from "./goal-plan-projection";
import { loadSkillSurvivors } from "./update-learner-skill";

/**
 * Where the skill projection reads Library rows: a GET's shared caches (`"shared"`, see
 * `library/_utils/shared-rows.ts`), or a write's client, which reads them after its own writes.
 */
export type LibrarySource = "shared" | TransactionClient;

/** The skills the Library says plan items' lessons and chapters teach (see `ItemSkillRows`). */
export async function loadItemSkillRows({
  chapterIds,
  lessonIds,
  tx = prisma,
}: {
  chapterIds: readonly string[];
  lessonIds: readonly string[];
  tx?: TransactionClient;
}): Promise<ItemSkillRows> {
  const [lessonSkills, chapterLessons] = await Promise.all([
    lessonIds.length === 0
      ? []
      : tx.lessonSkill.findMany({
          orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
          select: { lesson: { select: { homeChapterId: true } }, lessonId: true, skillId: true },
          where: { lessonId: { in: [...lessonIds] } },
        }),
    chapterIds.length === 0
      ? []
      : tx.chapterLesson.findMany({
          orderBy: { position: "asc" },
          select: {
            chapterId: true,
            lesson: {
              select: {
                skills: {
                  orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
                  select: { skillId: true },
                },
              },
            },
          },
          where: { chapterId: { in: [...chapterIds] } },
        }),
  ]);

  return { chapterLessons, lessonSkills };
}

function toLessonSkills({
  homes,
  rows,
}: {
  homes: readonly { homeChapterId: string | null; id: string }[];
  rows: readonly LessonSkillRow[];
}): ItemSkillRows["lessonSkills"] {
  const homeOf = new Map(homes.map((lesson) => [lesson.id, lesson.homeChapterId]));

  return rows.map((row) => ({
    lesson: { homeChapterId: homeOf.get(row.lessonId) ?? null },
    lessonId: row.lessonId,
    skillId: row.skillId,
  }));
}

/**
 * `loadItemSkillRows` from the shared caches. Which lessons a chapter holds changes under the
 * chapter's id (another app places and splits lessons), so that list is read fresh, ids only; the
 * skills of the lessons it names come from the shared rows keyed by those lessons.
 */
async function readSharedItemSkillRows({
  chapterIds,
  lessonIds,
}: {
  chapterIds: readonly string[];
  lessonIds: readonly string[];
}): Promise<ItemSkillRows> {
  const [lessonRows, homes, placements] = await Promise.all([
    getLessonSkillRows(toIdKey(lessonIds)),
    getLessonHomeChapterRows(toIdKey(lessonIds)),
    chapterIds.length === 0
      ? []
      : prisma.chapterLesson.findMany({
          orderBy: { position: "asc" },
          select: { chapterId: true, lessonId: true },
          where: { chapterId: { in: [...chapterIds] } },
        }),
  ]);

  const placedRows = await getLessonSkillRows(toIdKey(placements.map((row) => row.lessonId)));
  const skillsOf = Map.groupBy(placedRows, (row) => row.lessonId);

  return {
    chapterLessons: placements.map((placement) => ({
      chapterId: placement.chapterId,
      lesson: {
        skills: (skillsOf.get(placement.lessonId) ?? []).map((row) => ({ skillId: row.skillId })),
      },
    })),
    lessonSkills: toLessonSkills({ homes, rows: lessonRows }),
  };
}

/** `loadItemSkillRows` from where `from` says (see `LibrarySource`). */
export function readItemSkillRows(
  input: { chapterIds: readonly string[]; lessonIds: readonly string[] },
  from: LibrarySource,
): Promise<ItemSkillRows> {
  return from === "shared"
    ? readSharedItemSkillRows(input)
    : loadItemSkillRows({ ...input, tx: from });
}

/**
 * Skills are merged, never deleted: each skill maps to its survivor, or to itself (see
 * `loadSkillSurvivors`). Resolve merges fresh: Admin moves learner mastery to the survivor,
 * and its invalidation cannot clear Main's shared entries for the old ids.
 */
export async function readSurvivorOf(
  skillIds: readonly string[],
  from: LibrarySource,
): Promise<(skillId: string) => string> {
  return loadSkillSurvivors(skillIds, from === "shared" ? prisma : from);
}

/** These chapters' titles. */
export function readChapterTitles(chapterIds: readonly string[], from: LibrarySource) {
  return from === "shared"
    ? getChapterTitleRows(toIdKey(chapterIds))
    : from.chapter.findMany({
        select: { id: true, title: true },
        where: { id: { in: [...chapterIds] } },
      });
}

/** The prerequisite edges between these skills. */
export function readSkillEdges(skillIds: readonly string[], from: LibrarySource) {
  return from === "shared"
    ? getSkillPrerequisiteRows(toIdKey(skillIds))
    : from.skillPrerequisite.findMany({
        select: { prerequisiteId: true, skillId: true },
        where: { prerequisiteId: { in: [...skillIds] }, skillId: { in: [...skillIds] } },
      });
}

/** Each of these skills' level band. */
export function readSkillLevels(skillIds: readonly string[], from: LibrarySource) {
  return from === "shared"
    ? getSkillLevelRows(toIdKey(skillIds))
    : from.skill.findMany({
        select: { id: true, level: true },
        where: { id: { in: [...skillIds] } },
      });
}

/** Each skill's prerequisites among these (see `loadSkillPrerequisites`), from `from`. */
export async function readSkillPrerequisiteMap(
  skillIds: readonly string[],
  from: LibrarySource,
): Promise<Map<string, string[]>> {
  const edges = skillIds.length === 0 ? [] : await readSkillEdges(skillIds, from);

  return new Map(
    [...Map.groupBy(edges, (edge) => edge.skillId)].map(([skillId, list]) => [
      skillId,
      list.map((edge) => edge.prerequisiteId),
    ]),
  );
}
