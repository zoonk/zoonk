import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type QuickExplanation } from "@zoonk/ai/tasks/v2/explain/quick-explanation";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { buildLessonIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLibraryLessonCacheTag } from "../../cache/tags";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { resolvePlanInputDependents } from "../../plans/_utils/plan-input-dependencies";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { type LibraryProvenance, toProvenanceData } from "../_utils/library-rows";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { claimLibraryGeneration } from "../claims/generation-claim";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { startLessonVersion } from "../lessons/lesson-versions";
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
  const lostClaim = new Error("The explanation publication claim was lost");

  const { data: saved, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      const linkedSkills = await tx.lessonSkill.findMany({ where: { lessonId } });

      /** Explicit skills include plans that still refer to a merged skill's identity. */
      const planIds = await resolvePlanInputDependents(tx, {
        lessonIds: [lessonId],
        skillIds: linkedSkills.map(({ skillId: linkedSkillId }) => linkedSkillId),
      });

      await markPlansChanged(tx, { planIds });

      const claimed = await tx.lesson.updateMany({
        data: {
          contentStatus: "completed",
          relatedQuestions: explanation.goFurther.relatedQuestions,
          summary: { ideas: explanation.recap.map((text) => ({ text })) },
        },
        where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
      });

      if (claimed.count === 0) {
        throw lostClaim;
      }

      const version = await startLessonVersion(tx, lessonId);

      await tx.step.createMany({
        data: steps.map((step, position) => ({
          content: step.content,
          contractVersion: STEP_CONTRACT_VERSION,
          kind: step.kind,
          lessonId,
          position,
          skillId,
          version,
          ...toProvenanceData(provenance),
        })),
      });

      return true;
    }),
  );

  if (error === lostClaim) {
    return false;
  }

  if (error) {
    throw error;
  }

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

  await saveExplanationLink({ courseId, goalId, relatedQuestions });
}

async function saveExplanationLink({
  courseId,
  goalId,
  relatedQuestions,
}: {
  courseId: string | null;
  goalId: string;
  relatedQuestions: string[];
}): Promise<void> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return;
  }

  const planInputs = goal.primaryCourseId === null && courseId !== null;

  const retry = await writeLearnerChange({ planInputs, userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findUnique({ where: { id: goalId } });

    if (!current) {
      return unchanged(false);
    }

    // A concurrent course link changes which locks this write needs; retry in the global order.
    if ((current.primaryCourseId === null && courseId !== null) !== planInputs) {
      return unchanged(true);
    }

    const details = isJsonObject(current.details) ? current.details : {};
    const primaryCourseId = current.primaryCourseId ?? courseId;

    if (
      primaryCourseId === current.primaryCourseId &&
      isDeepStrictEqual(details.relatedQuestions, relatedQuestions)
    ) {
      return unchanged(false);
    }

    await tx.goal.update({
      data: { details: { ...details, relatedQuestions }, primaryCourseId },
      where: { id: goalId },
    });

    return false;
  });

  if (retry) {
    return saveExplanationLink({ courseId, goalId, relatedQuestions });
  }

  revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
}

/**
 * Points an explain goal and its explanation at the subject's Overview course for "Want to go
 * further?", unless they already have one. The lesson keeps it for every learner it's reused for
 * (`findExplanationGoFurther`). A new explanation is linked to its goal first, so the learner reads
 * it while the course is found.
 */
export async function linkGoFurtherCourse({
  courseId,
  goalId,
  lessonId,
}: {
  courseId: string;
  goalId: string;
  lessonId: string;
}): Promise<void> {
  const [goal] = await Promise.all([
    prisma.goal.findUnique({
      select: { primaryCourseId: true, userId: true },
      where: { id: goalId },
    }),
    prisma.lesson.updateMany({
      data: { goFurtherCourseId: courseId },
      where: { goFurtherCourseId: null, id: lessonId },
    }),
  ]);

  if (!goal || goal.primaryCourseId) {
    return;
  }

  await writeLearnerChange({ planInputs: true, userId: goal.userId }, async (tx) => {
    const updated = await tx.goal.updateMany({
      data: { primaryCourseId: courseId },
      where: { id: goalId, primaryCourseId: null },
    });

    if (updated.count === 0) {
      return unchanged(null);
    }
  });

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
 * and related questions its lesson keeps, whoever asked first. Only a shared course is passed on.
 */
export async function findExplanationGoFurther(
  lessonId: string,
): Promise<{ courseId: string | null; relatedQuestions: string[] }> {
  const lesson = await prisma.lesson.findUnique({
    select: { goFurtherCourse: { select: { id: true, visibility: true } }, relatedQuestions: true },
    where: { id: lessonId },
  });

  const course = lesson?.goFurtherCourse;

  return {
    courseId: course?.visibility === "public" ? course.id : null,
    relatedQuestions: lesson?.relatedQuestions ?? [],
  };
}
