import "server-only";
import { type generateCourseOutline } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { type CourseLevel, prisma } from "@zoonk/db";
import { type LibraryProvenance } from "../_utils/library-rows";
import { createChapterChallenge } from "../challenges/chapter-challenge";
import { attachChapterToCourse } from "../chapters/attach-course-chapter";
import { parseChapterTools } from "../chapters/chapter-tools";
import { createLibraryChapter } from "../chapters/create-library-chapter";
import { claimLibraryGeneration, finishLibraryGeneration } from "../claims/generation-claim";
import { type IdentityCourse } from "../identity/_utils/identity-requests";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { attachLessonToChapter } from "../lessons/attach-chapter-lesson";
import {
  type CurriculumAnalytics,
  type CurriculumScope,
  type GoalSkillRef,
} from "./curriculum-scope";
import { resolveScopeLessons } from "./resolve-lesson-skills";

export type CourseOutline = Awaited<ReturnType<typeof generateCourseOutline>>["data"];
export type OutlineChapter = CourseOutline["chapters"][number];

type ChapterContext = {
  analytics?: CurriculumAnalytics;
  courseId: string;
  goalSkills: readonly GoalSkillRef[];
  level: CourseLevel;
  provenance: LibraryProvenance;
  scope: CurriculumScope;
  workflowRunId: string;
};

export type SavedOutlineChapter = { chapterId: string; lessonIds: string[] };

/** The outline's context with the course it's written for, which identity search scopes by. */
type OutlineContext = ChapterContext & { course: IdentityCourse };

async function resolveChapter({
  chapter,
  context,
}: {
  chapter: OutlineChapter;
  context: OutlineContext;
}): Promise<string> {
  const { analytics, course, level, provenance, scope } = context;

  const resolution = await resolveLibraryIdentity({
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

/**
 * Finds or creates the chapter's lessons together (see `resolveScopeLessons`), in the outline's
 * order, and gives each new one the outline's can-do line, so session tiles have it before the
 * spec exists.
 */
async function resolveChapterLessons({
  chapter,
  chapterId,
  context,
}: {
  chapter: OutlineChapter;
  chapterId: string;
  context: OutlineContext;
}): Promise<(string | null)[]> {
  const resolved = await resolveScopeLessons({
    ...context,
    homeChapterId: chapterId,
    lessons: chapter.lessons.map((lesson) => ({
      ...lesson,
      skills: lesson.skills.map((name) => ({
        description: lesson.canDo || lesson.description,
        name,
      })),
    })),
  });

  const created = chapter.lessons.flatMap((lesson, index) => {
    const saved = resolved[index];
    return saved?.created ? [{ canDo: lesson.canDo, id: saved.id }] : [];
  });

  await Promise.all(
    created.map(({ canDo, id }) =>
      prisma.lesson.updateMany({ data: { canDo }, where: { canDo: null, id } }),
    ),
  );

  return resolved.map((lesson) => lesson?.id ?? null);
}

/**
 * Writes the lessons of a chapter this run claimed, in the outline's order, and the tools they
 * use. A lesson that another chapter of the course already has (same skills, same level) is placed
 * here too instead of written again, so it keeps one home and one copy. Placements a failed earlier
 * attempt left are cleared first, so the chapter always ends with exactly this outline's order.
 */
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

  // The chapter ends with a challenge on the skills its lessons teach.
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

  await prisma.chapterLesson.deleteMany({ where: { chapterId } });

  await Promise.all([
    ...placed.map((lessonId, position) => attachLessonToChapter({ chapterId, lessonId, position })),
    prisma.chapter.update({
      data: { tools: parseChapterTools(chapter.tools) },
      where: { id: chapterId },
    }),
  ]);
}

/**
 * Ends the chapter's outline claim as failed when writing its lessons throws, so a retry of the
 * same step (or a later run) can claim it again instead of waiting on a claim nobody finishes.
 */
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

  await prisma.chapterSkill.createMany({
    data: skillIds.map((skillId) => ({ chapterId, skillId })),
    skipDuplicates: true,
  });
}

/**
 * Puts one chapter of a course outline in the Library: the chapter itself (or the one identity
 * search found teaching the same scope), its place in the course's level band, the goal skills
 * the outline says it teaches, and, when this run claims the chapter's outline, every lesson's
 * title, description, can-do line and skills, and the tools the lessons use. Chapters and lessons
 * are only matched exactly inside this course; another course's are reused when the reuse
 * decision, seeing both courses, finds them on the same subject. A chapter whose lessons another
 * run wrote or is writing keeps them. Retries find everything by identity and placement, so
 * nothing is doubled.
 *
 * This is a workflow bridge: the scope's owner comes from the goal the public boundary loaded.
 */
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
