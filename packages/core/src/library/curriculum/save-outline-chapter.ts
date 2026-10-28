import "server-only";
import { type generateCourseOutline } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { type CourseLevel, prisma } from "@zoonk/db";
import { type LibraryProvenance } from "../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";
import { createChapterChallenge } from "../challenges/chapter-challenge";
import { attachChapterToCourse } from "../chapters/attach-course-chapter";
import { parseChapterTools } from "../chapters/chapter-tools";
import { createLibraryChapter } from "../chapters/create-library-chapter";
import { claimLibraryGeneration, finishLibraryGeneration } from "../claims/generation-claim";
import { type IdentityCourse } from "../identity/_utils/identity-requests";
import { resolveLibraryIdentity } from "../identity/resolve-library-identity";
import { placeChapterLessons } from "../lessons/place-chapter-lessons";
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

async function resolveChapterLessons({
  chapter,
  chapterId,
  context,
}: {
  chapter: OutlineChapter;
  chapterId: string;
  context: OutlineContext;
}): Promise<(string | null)[]> {
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

  await writePlanInputs(async (tx) => {
    await lockPlanSourceWrite(tx, { chapterIds: [chapterId], skillIds });

    await tx.chapterSkill.createMany({
      data: skillIds.map((skillId) => ({ chapterId, skillId })),
      skipDuplicates: true,
    });
  });
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
