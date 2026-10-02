import "server-only";
import { type QuickExplanation } from "@zoonk/ai/tasks/v2/explain/quick-explanation";
import { prisma } from "@zoonk/db";
import { buildLessonIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { claimLibraryGeneration } from "../claims/generation-claim";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { STEP_CONTRACT_VERSION } from "../steps/contract/step-contract";
import { type ExplanationStep } from "./explanation-steps";

/** A quick explanation is a few short screens: about four minutes with its check. */
const EXPLANATION_MINUTES = 4;

type ExplanationScope = { language: string; ownerId: string | null };

export type SavedExplanation = { lessonId: string; status: "busy" | "reused" | "saved" };

/**
 * The explanation lesson that already answers a question skill: the first one written, visible
 * to this learner. Explanations are overview lessons teaching the question as their one skill.
 */
export async function findExplanationLesson({
  ownerId,
  skillId,
}: {
  ownerId: string | null;
  skillId: string;
}): Promise<string | null> {
  const lesson = await prisma.lesson.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: {
      ...libraryRowsVisibleTo(ownerId),
      contentStatus: "completed",
      level: "overview",
      skills: { some: { skillId } },
    },
  });

  return lesson?.id ?? null;
}

async function publishSteps({
  explanation,
  lessonId,
  provenance,
  skillId,
  steps,
  workflowRunId,
}: {
  explanation: QuickExplanation;
  lessonId: string;
  provenance: LibraryProvenance;
  skillId: string;
  steps: readonly ExplanationStep[];
  workflowRunId: string;
}): Promise<boolean> {
  const saved = await prisma.$transaction(async (tx) => {
    const claimed = await tx.lesson.updateMany({
      data: {
        contentStatus: "completed",
        summary: { ideas: explanation.recap.map((text) => ({ text })) },
      },
      where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
    });

    if (claimed.count === 0) {
      return false;
    }

    await tx.step.deleteMany({ where: { lessonId } });

    await tx.step.createMany({
      data: steps.map((step, position) => ({
        content: step.content,
        contractVersion: STEP_CONTRACT_VERSION,
        kind: step.kind,
        lessonId,
        position,
        skillId,
        ...toProvenanceData(provenance),
      })),
    });

    return true;
  });

  if (saved) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return saved;
}

/**
 * Stores a checked quick explanation as an overview lesson teaching the question skill, so the
 * next learner asking the same thing in other words (the skill's identity search) gets it at once.
 * A personal question's lesson is private to its learner. When another run already wrote the
 * lesson it is reused; when another run is writing it, `busy` says so.
 *
 * This is a workflow bridge: the scope's owner comes from the goal the public boundary created.
 */
export async function saveExplanationLesson({
  explanation,
  provenance,
  scope,
  skillId,
  steps,
  workflowRunId,
}: {
  explanation: QuickExplanation;
  provenance: LibraryProvenance;
  scope: ExplanationScope;
  skillId: string;
  steps: readonly ExplanationStep[];
  workflowRunId: string;
}): Promise<SavedExplanation> {
  const identityKey = scopeIdentityKey({
    key: buildLessonIdentityKey({
      courseId: null,
      level: "overview",
      skillIds: [skillId],
      targetLanguage: null,
    }),
    ownerId: scope.ownerId,
  });

  const { lesson } = await createLibraryLesson({
    description: explanation.screens[0]?.title ?? explanation.title,
    estimatedMinutes: EXPLANATION_MINUTES,
    homeChapterId: null,
    identityKey,
    language: scope.language,
    level: "overview",
    ownerId: scope.ownerId,
    provenance,
    skillIds: [skillId],
    targetLanguage: null,
    title: explanation.title,
  });

  const claim = await claimLibraryGeneration({
    id: lesson.id,
    target: "lessonContent",
    workflowRunId,
  });

  if (claim !== "claimed") {
    return { lessonId: lesson.id, status: claim === "completed" ? "reused" : "busy" };
  }

  const saved = await publishSteps({
    explanation,
    lessonId: lesson.id,
    provenance,
    skillId,
    steps,
    workflowRunId,
  });

  return { lessonId: lesson.id, status: saved ? "saved" : "busy" };
}

/**
 * Points an explain goal at its explanation: a one-item plan with the lesson (what the explain
 * screen and Today read), the subject's Overview course for "Want to go further?" and the related
 * questions to ask next.
 */
export async function linkExplanationToGoal({
  courseId,
  goalId,
  relatedQuestions,
  skill,
  title,
}: {
  courseId: string | null;
  goalId: string;
  relatedQuestions: string[];
  skill: { id: string; name: string };
  title: string;
}): Promise<void> {
  await createGoalPlan({
    goalId,
    graph: {
      phases: [{ milestone: null, name: title }],
      skills: [
        { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
      ],
    },
  });

  const goal = await prisma.goal.findUnique({
    select: { details: true, primaryCourseId: true, userId: true },
    where: { id: goalId },
  });

  if (!goal) {
    return;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};

  await prisma.goal.update({
    data: {
      details: { ...details, relatedQuestions },
      // Without a course the column is left alone: a new explanation's course is linked on its own.
      primaryCourseId: goal.primaryCourseId ?? courseId ?? undefined,
    },
    where: { id: goalId },
  });

  revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
}

/**
 * Points an explain goal at the subject's Overview course for "Want to go further?", unless it
 * already has one. A new explanation is linked to its goal first, so the learner reads it while
 * the course is found.
 */
export async function linkGoFurtherCourse({
  courseId,
  goalId,
}: {
  courseId: string;
  goalId: string;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({
    select: { primaryCourseId: true, userId: true },
    where: { id: goalId },
  });

  if (!goal || goal.primaryCourseId) {
    return;
  }

  await prisma.goal.update({ data: { primaryCourseId: courseId }, where: { id: goalId } });

  revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
}

/** The follow-up questions stored on an explanation goal, without blanks. */
export function readRelatedQuestions(details: Record<string, unknown>): string[] {
  const questions = details.relatedQuestions;

  return Array.isArray(questions)
    ? questions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

/**
 * "Want to go further?" for an explanation someone already asked for: the shared Overview course
 * and related questions the first goal that got it was given. Only a shared course is passed on.
 */
export async function findExplanationGoFurther(
  lessonId: string,
): Promise<{ courseId: string | null; relatedQuestions: string[] }> {
  const goal = await prisma.goal.findFirst({
    orderBy: { createdAt: "asc" },
    select: { details: true, primaryCourse: { select: { id: true, visibility: true } } },
    where: { kind: "explain", plan: { items: { some: { lessonId } } } },
  });

  const details = isJsonObject(goal?.details) ? goal.details : {};
  const course = goal?.primaryCourse;

  return {
    courseId: course?.visibility === "public" ? course.id : null,
    relatedQuestions: readRelatedQuestions(details),
  };
}
