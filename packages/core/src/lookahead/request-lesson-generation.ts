import "server-only";
import { prisma } from "@zoonk/db";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimUsage, claimUsageFor } from "../entitlements/claim-usage";
import { type UsageDecision } from "../entitlements/contract";
import { isVisibleTo } from "../library/_utils/library-visibility";
import { getLessonGenerationState } from "../library/generation/lesson-generation-state";
import { isLessonPlusOnly } from "../sessions/_utils/plus-only-lessons";
import { findViewerLesson } from "./_utils/viewer-lesson";

/** generating follows the existing stream; start requires a caller-started run. setAside must never restart generation. */
export type LessonGenerationRequest =
  | { status: "ready" }
  | { generationId: string; status: "generating" }
  | {
      analytics: {
        distinctId: string;
        goalId: string | undefined;
        platform: AnalyticsPlatform | null;
      };
      forExam: boolean;
      lessonId: string;
      status: "start";
    }
  | { decision: Exclude<UsageDecision, { status: "allowed" | "unauthorized" }>; status: "refused" }
  | { status: "setAside" }
  | { status: "notFound" }
  | { status: "plusRequired" }
  | { status: "unauthorized" };

async function getActiveGoal(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { activeGoal: { select: { id: true, kind: true } } },
    where: { userId },
  });

  return profile?.activeGoal ?? null;
}

async function requestFor({
  claim,
  lessonId,
  platform,
  userId,
}: {
  claim: (input: Parameters<typeof claimUsage>[0]) => Promise<UsageDecision>;
  lessonId: string;
  platform: AnalyticsPlatform | null;
  userId: string;
}): Promise<LessonGenerationRequest> {
  if (await isLessonPlusOnly({ lessonId, userId })) {
    return { status: "plusRequired" };
  }

  const state = await getLessonGenerationState(lessonId);

  if (!state) {
    return { status: "notFound" };
  }

  if (state.status === "ready") {
    return { status: "ready" };
  }

  if (state.status === "generating") {
    return { generationId: state.runId, status: "generating" };
  }

  // A lesson no run will write must not consume a lesson allowance.
  if (state.status === "failed" && state.setAside) {
    return { status: "setAside" };
  }

  const decision = await claim({ generated: true, kind: "lessonStart", targetId: lessonId });

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  const goal = await getActiveGoal(userId);

  return {
    analytics: { distinctId: userId, goalId: goal?.id, platform },
    forExam: goal?.kind === "exam",
    lessonId,
    status: "start",
  };
}

/** Claims the later lesson start before AI work; starting after generation must not consume allowance again. */
export async function requestLessonGeneration({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonGenerationRequest> {
  const viewer = await findViewerLesson(lessonId);

  if (viewer.status !== "ready") {
    return viewer;
  }

  return requestFor({
    claim: claimUsage,
    lessonId,
    platform: await getRequestPlatform(),
    userId: viewer.userId,
  });
}

/** Internal, for the lesson a learner's write owes: `userId` must come from that write. */
export async function requestLessonGenerationFor({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<LessonGenerationRequest> {
  const lesson = await prisma.lesson.findUnique({
    select: { ownerId: true, visibility: true },
    where: { id: lessonId },
  });

  if (!lesson || !isVisibleTo({ row: lesson, viewerId: userId })) {
    return { status: "notFound" };
  }

  return requestFor({
    claim: (input) => claimUsageFor({ ...input, userId }),
    lessonId,
    platform: null,
    userId,
  });
}
