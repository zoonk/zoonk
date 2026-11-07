import "server-only";
import { createHash } from "node:crypto";
import { type generateCourseOutline } from "@zoonk/ai/tasks/curriculum/course-outline";
import { type CourseLevel, prisma } from "@zoonk/db";
import { buildLessonIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { type LibraryProvenance } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { createChapterChallenge } from "../challenges/chapter-challenge";
import { attachChapterToCourse } from "../chapters/attach-course-chapter";
import { parseChapterTools } from "../chapters/chapter-tools";
import { createLibraryChapter } from "../chapters/create-library-chapter";
import { claimLibraryGeneration, finishLibraryGeneration } from "../claims/generation-claim";
import { type IdentityCourse } from "../identity/_utils/identity-requests";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { createHomeChapterLessons } from "../lessons/create-library-lesson";
import { placeChapterLessons } from "../lessons/place-chapter-lessons";
import { createSkill } from "../skills/create-skill";
import {
  type CurriculumAnalytics,
  type CurriculumScope,
  type GoalSkillRef,
} from "./curriculum-scope";
import { resolveScopeLessons } from "./resolve-lesson-skills";
import { tagChapterSkills } from "./teaching-chapters";

export type CourseOutline = Awaited<ReturnType<typeof generateCourseOutline>>["data"];
export type OutlineChapter = CourseOutline["chapters"][number];

/**
 * Identities for a chapter that's new with new skills, such as a release's What's new, so nothing
 * is matched against the library and a retry finds what an earlier try saved. Its lessons are named
 * by those skills and their literal titles.
 */
export type OutlineKeys = { chapter: string; skill: (name: string) => string };

type ChapterContext = {
  analytics?: CurriculumAnalytics;
  courseId: string;
  goalSkills: readonly GoalSkillRef[];
  keys?: OutlineKeys;
  level: CourseLevel;
  provenance: LibraryProvenance;
  scope: CurriculumScope;
  workflowRunId: string;
};

export type SavedOutlineChapter = { chapterId: string; lessonIds: string[] };

type OutlineContext = ChapterContext & { course: IdentityCourse };

async function resolveChapter({
  chapter,
  context,
}: {
  chapter: OutlineChapter;
  context: OutlineContext;
}): Promise<string> {
  const { analytics, course, keys, level, provenance, scope } = context;

  const resolution = keys
    ? { identityKey: keys.chapter, kind: "generate" as const }
    : await resolveLibraryIdentity({
        analytics,
        request: {
          course,
          description: chapter.description,
          goal: scope.generalGoal,
          kind: "chapter",
          language: scope.language,
          level,
          objectives: chapter.objectives,
          ownerId: scope.ownerId,
          targetLanguage: scope.targetLanguage,
          title: chapter.title,
        },
      });

  if (resolution.kind === "existing") {
    return resolution.id;
  }

  const created = await createLibraryChapter({
    description: chapter.description,
    homeCourseId: course.id,
    identityKey: resolution.identityKey,
    language: scope.language,
    level,
    objectives: chapter.objectives,
    ownerId: scope.ownerId,
    provenance,
    targetLanguage: scope.targetLanguage,
    title: chapter.title,
  });

  return created.chapter.id;
}

const TITLE_HASH_LENGTH = 12;

/** The identity builder drops punctuation, so "Use C++" and "Use C#" keep apart by a hash of their own. */
function toLiteralTitle(title: string): string {
  return `${title} ${createHash("sha256").update(title).digest("hex").slice(0, TITLE_HASH_LENGTH)}`;
}

async function createKeyedLessons({
  chapter,
  chapterId,
  context,
  keys,
}: {
  chapter: OutlineChapter;
  chapterId: string;
  context: OutlineContext;
  keys: OutlineKeys;
}): Promise<(string | null)[]> {
  const { level, provenance, scope } = context;

  const named = new Map(
    chapter.lessons.flatMap((lesson) =>
      lesson.skills.map((name) => [name, lesson.canDo || lesson.description] as const),
    ),
  );

  const skills = await Promise.all(
    [...named].map(async ([name, description]) => {
      const { skill } = await createSkill({
        description,
        example: null,
        identityKey: keys.skill(name),
        language: scope.language,
        level,
        name,
        ownerId: scope.ownerId,
        provenance,
        targetLanguage: scope.targetLanguage,
      });

      return [name, skill.id] as const;
    }),
  );

  const skillIds = new Map(skills);

  const keyed = chapter.lessons.flatMap((lesson, index) => {
    const ids = lesson.skills.flatMap((name) => skillIds.get(name) ?? []);
    return ids.length > 0 ? [{ ids, index, lesson }] : [];
  });

  const created = await createHomeChapterLessons({
    homeChapterId: chapterId,
    lessons: keyed.map(({ ids, lesson }) => ({
      canDo: lesson.canDo,
      description: lesson.description,
      estimatedMinutes: lesson.estimatedMinutes,
      identityKey: scopeIdentityKey({
        key: buildLessonIdentityKey({
          courseId: context.course.id,
          level,
          skillIds: ids,
          targetLanguage: scope.targetLanguage,
          title: toLiteralTitle(lesson.title),
        }),
        ownerId: scope.ownerId,
      }),
      language: scope.language,
      level,
      provenance,
      skillIds: ids,
      targetLanguage: scope.targetLanguage,
      title: lesson.title,
    })),
    ownerId: scope.ownerId,
  });

  const byIndex = new Map(
    keyed.map(({ index }, position) => [index, created[position]?.lesson.id]),
  );

  return chapter.lessons.map((_, index) => byIndex.get(index) ?? null);
}

async function resolveChapterLessons({
  chapter,
  chapterId,
  context,
}: {
  chapter: OutlineChapter;
  chapterId: string;
  context: OutlineContext;
}): Promise<(string | null)[]> {
  if (context.keys) {
    return createKeyedLessons({ chapter, chapterId, context, keys: context.keys });
  }

  return resolveScopeLessons({
    ...context,
    homeChapterId: chapterId,
    lessons: chapter.lessons.map((lesson) => ({
      canDo: lesson.canDo,
      description: lesson.description,
      estimatedMinutes: lesson.estimatedMinutes,
      skills: lesson.skills.map((name) => ({
        description: lesson.canDo || lesson.description,
        name,
      })),
      title: lesson.title,
    })),
  });
}

async function writeChapterLessons({
  chapter,
  chapterId,
  context,
}: {
  chapter: OutlineChapter;
  chapterId: string;
  context: OutlineContext;
}): Promise<void> {
  const lessonIds = await resolveChapterLessons({ chapter, chapterId, context });

  const challengeId = await createChapterChallenge({
    chapterId,
    chapterTitle: chapter.title,
    language: context.scope.language,
    level: context.level,
    ownerId: context.scope.ownerId,
    provenance: context.provenance,
    skills: chapter.lessons.filter((_, index) => lessonIds[index]).flatMap((item) => item.skills),
    targetLanguage: context.scope.targetLanguage,
  });

  const placed = [...new Set([...lessonIds, challengeId].filter((id) => id !== null))];

  await placeChapterLessons({ chapterId, lessonIds: placed });

  await writePlanInputs(async (tx) => {
    await lockPlanSourceWrite(tx, { chapterIds: [chapterId] });

    await tx.chapter.update({
      data: { tools: parseChapterTools(chapter.tools) },
      where: { id: chapterId },
    });
  });
}

async function writeClaimedChapter({
  chapter,
  chapterId,
  context,
}: {
  chapter: OutlineChapter;
  chapterId: string;
  context: OutlineContext;
}): Promise<void> {
  const claim = {
    id: chapterId,
    target: "chapterOutline" as const,
    workflowRunId: context.workflowRunId,
  };

  try {
    await writeChapterLessons({ chapter, chapterId, context });
  } catch (error) {
    await finishLibraryGeneration({ ...claim, status: "failed" });
    throw error;
  }

  await finishLibraryGeneration({ ...claim, status: "completed" });
}

async function linkChapterGoalSkills({
  chapter,
  chapterId,
  goalSkills,
}: {
  chapter: OutlineChapter;
  chapterId: string;
  goalSkills: readonly GoalSkillRef[];
}): Promise<void> {
  const skillIds = goalSkills
    .filter((skill) => chapter.skillKeys.includes(skill.key))
    .map((skill) => skill.id);

  await tagChapterSkills([{ chapterId, skillIds }]);
}

function getChapterArea({
  chapter,
  goalSkills,
}: {
  chapter: OutlineChapter;
  goalSkills: readonly GoalSkillRef[];
}): string | null {
  const areas = new Set(
    chapter.skillKeys.map((key) => goalSkills.find((skill) => skill.key === key)?.area ?? null),
  );

  return areas.size === 1 ? [...areas][0] || null : null;
}

/** Internal workflow bridge: the owner must come from the goal the public boundary authorized. */
export async function saveOutlineChapter({
  chapter,
  position,
  ...chapterContext
}: ChapterContext & { chapter: OutlineChapter; position: number }): Promise<SavedOutlineChapter> {
  const course = await prisma.course.findUniqueOrThrow({
    select: { id: true, title: true },
    where: { id: chapterContext.courseId },
  });

  const context = { ...chapterContext, course };
  const chapterId = await resolveChapter({ chapter, context });

  await Promise.all([
    attachChapterToCourse({
      area: getChapterArea({ chapter, goalSkills: context.goalSkills }),
      chapterId,
      courseId: context.courseId,
      level: context.level,
      position,
    }),
    linkChapterGoalSkills({ chapter, chapterId, goalSkills: context.goalSkills }),
  ]);

  const claim = await claimLibraryGeneration({
    id: chapterId,
    target: "chapterOutline",
    workflowRunId: context.workflowRunId,
  });

  if (claim === "claimed") {
    await writeClaimedChapter({ chapter, chapterId, context });
  }

  const lessons = await prisma.chapterLesson.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    where: { chapterId },
  });

  return { chapterId, lessonIds: lessons.map((lesson) => lesson.lessonId) };
}
