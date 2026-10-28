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

const EXPLANATION_MINUTES = 4;

type ExplanationScope = { language: string; ownerId: string | null };

export type SavedExplanation = { lessonId: string; status: "busy" | "reused" | "saved" };

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

/** Internal workflow bridge: the owner must come from the goal the public boundary authorized. */
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

  const marker = { planInputs, userId: goal.userId };

  const retry = await writeLearnerChange(marker, async (tx) => {
    const current = await tx.goal.findUnique({ where: { id: goalId } });

    if (!current) {
      return unchanged(false);
    }

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

  const marker = { planInputs: true, userId: goal.userId };

  await writeLearnerChange(marker, async (tx) => {
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

export function readRelatedQuestions(details: Record<string, unknown>): string[] {
  const questions = details.relatedQuestions;

  return Array.isArray(questions)
    ? questions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

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
