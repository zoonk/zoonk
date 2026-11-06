import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { proposePlanChange } from "../../plans/propose-plan-change";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { type CurriculumAnalytics, type GoalSkillRef } from "../curriculum/curriculum-scope";
import {
  type OutlineChapter,
  type SavedOutlineChapter,
  saveOutlineChapter,
} from "../curriculum/save-outline-chapter";
import { courseFollowersFilter } from "./course-release";

const OFFER_PAGE_SIZE = 50;

/** Internal workflow bridge: what the "What's new" chapter's outline needs from its course. */
export async function loadWhatsNewOutline(courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({
    select: {
      courseChapters: { select: { chapter: { select: { title: true } } } },
      language: true,
      title: true,
    },
    where: { id: courseId },
  });

  return {
    chapterTitles: course.courseChapters.map((placement) => placement.chapter.title),
    courseTitle: course.title,
    language: course.language,
  };
}

/**
 * Internal workflow bridge: the course's chapter teaching the release's What's new skills, when an
 * earlier run that failed before the move already saved it, so a new run offers what that chapter
 * teaches instead of writing a second one.
 */
export async function findWhatsNewChapter({
  courseId,
  releaseId,
}: {
  courseId: string;
  releaseId: string;
}): Promise<{ lessonIds: string[]; skills: GoalSkillRef[] } | null> {
  const chapter = await prisma.chapter.findFirst({
    select: {
      goalSkills: {
        select: { skill: { select: { description: true, id: true, name: true } } },
        where: { skill: { identityKey: { startsWith: `whats-new:${releaseId}:` } } },
      },
      lessons: { select: { lessonId: true } },
    },
    where: {
      courses: { some: { courseId } },
      // A chapter whose lessons failed to save goes through the save again, which claims it anew.
      outlineStatus: "completed",
      goalSkills: { some: { skill: { identityKey: { startsWith: `whats-new:${releaseId}:` } } } },
    },
  });

  if (!chapter) {
    return null;
  }

  return {
    lessonIds: chapter.lessons.map((placement) => placement.lessonId),
    skills: chapter.goalSkills.map(({ skill }) => ({ ...skill, key: skill.id })),
  };
}

/** Internal workflow bridge: the chapter goes last in its band of the product's main course. */
export async function saveWhatsNewChapter({
  analytics,
  chapter,
  courseId,
  level,
  provenance,
  skills,
  workflowRunId,
}: {
  analytics?: CurriculumAnalytics;
  chapter: OutlineChapter;
  courseId: string;
  level: CourseLevel;
  provenance: LibraryProvenance;
  skills: GoalSkillRef[];
  workflowRunId: string;
}): Promise<SavedOutlineChapter> {
  const [course, last] = await Promise.all([
    prisma.course.findUniqueOrThrow({ select: { language: true }, where: { id: courseId } }),
    prisma.courseChapter.findFirst({
      orderBy: { position: "desc" },
      select: { position: true },
      where: { courseId, level },
    }),
  ]);

  return saveOutlineChapter({
    analytics,
    chapter,
    courseId,
    goalSkills: skills,
    level,
    position: (last?.position ?? -1) + 1,
    provenance,
    scope: { generalGoal: null, language: course.language, ownerId: null, targetLanguage: null },
    workflowRunId,
  });
}

type ReleaseOffer = {
  courseId: string;
  /** Lessons each skill adds to a plan. */
  lessons: number;
  offer: string;
  provenance: LibraryProvenance;
  releaseId: string;
  skills: GoalSkillRef[];
};

async function hasReleaseChange({ goalId, releaseId }: { goalId: string; releaseId: string }) {
  const change = await prisma.planChange.findFirst({
    select: { id: true },
    where: { payload: { equals: releaseId, path: ["releaseId"] }, plan: { goalId } },
  });

  return change !== null;
}

async function offerToGoal({ goalId, offer }: { goalId: string; offer: ReleaseOffer }) {
  if (await hasReleaseChange({ goalId, releaseId: offer.releaseId })) {
    return;
  }

  const next = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { skillId: true },
    where: { plan: { goalId }, skillId: { not: null }, status: "todo" },
  });

  await proposePlanChange({
    approval: "always",
    goalId,
    operations: [
      {
        kind: "addSkills",
        skills: offer.skills.map((skill) => ({
          area: null,
          beforeSkillId: next?.skillId ?? null,
          courseId: offer.courseId,
          lessons: offer.lessons,
          name: skill.name,
          skillId: skill.id,
        })),
      },
    ],
    payload: { releaseId: offer.releaseId },
    provenance: toProvenanceData(offer.provenance),
    reason: offer.offer,
    source: "release",
  });
}

/**
 * Internal workflow bridge, run before the course moves. Offers the "What's new" skills, as a
 * change to approve, to one page of the course's followers already past its start (a learner who
 * hasn't done a lesson in it, or starts later, gets the updated course), once per goal and release.
 * Returns where the next page starts, or null after the last.
 */
export async function offerWhatsNew({
  after,
  ...offer
}: ReleaseOffer & { after: string | null }): Promise<string | null> {
  const goals = await prisma.goal.findMany({
    orderBy: { id: "asc" },
    select: { id: true },
    take: OFFER_PAGE_SIZE,
    where: {
      ...courseFollowersFilter(offer.courseId),
      plan: {
        items: {
          some: { chapter: { courses: { some: { courseId: offer.courseId } } }, status: "done" },
        },
      },
      ...(after && { id: { gt: after } }),
    },
  });

  await goals.reduce(
    (previous, goal) => previous.then(() => offerToGoal({ goalId: goal.id, offer })),
    Promise.resolve(),
  );

  return goals.length === OFFER_PAGE_SIZE ? (goals.at(-1)?.id ?? null) : null;
}
