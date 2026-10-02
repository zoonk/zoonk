import "server-only";
import { prisma } from "@zoonk/db";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimUsage } from "../entitlements/claim-usage";
import { type UsageDecision } from "../entitlements/contract";
import { getLessonGenerationState } from "../library/generation/lesson-generation-state";
import { findViewerLesson } from "./_utils/viewer-lesson";

/**
 * `ready`: play it. `generating`: follow `generationId`'s stream (a run already writing it).
 * `start`: the caller starts a run with these inputs, whose analytics name the learner, their goal
 * and the client that asked. `refused`: the learner's allowance doesn't
 * cover writing a new lesson now. `setAside`: its last allowed draft was held back, so nothing
 * writes it again; plans moved on without it.
 */
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
  | { status: "unauthorized" };

async function getActiveGoal(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { activeGoal: { select: { id: true, kind: true } } },
    where: { userId },
  });

  return profile?.activeGoal ?? null;
}

/**
 * Decides what asking for a lesson's content does. A lesson already written plays; one being
 * written is followed, so two requests never pay twice. Asking to write one counts as the lesson
 * start it leads to (starting it later counts nothing more), so the allowance and fair use are
 * enforced before any AI work and no guest or account can write a whole plan by asking for each
 * lesson; lessons the plan writes ahead for its sessions never ask here. A lesson the quality gate
 * held back is drafted again while it has drafts left.
 */
export async function requestLessonGeneration({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonGenerationRequest> {
  const viewer = await findViewerLesson(lessonId);

  if (viewer.status !== "ready") {
    return viewer;
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

  // Before the allowance: asking for a lesson nothing will write never costs a lesson start.
  if (state.status === "failed" && state.setAside) {
    return { status: "setAside" };
  }

  const decision = await claimUsage({ generated: true, kind: "lessonStart", targetId: lessonId });

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  const [goal, platform] = await Promise.all([getActiveGoal(viewer.userId), getRequestPlatform()]);

  return {
    analytics: { distinctId: viewer.userId, goalId: goal?.id, platform },
    forExam: goal?.kind === "exam",
    lessonId,
    status: "start",
  };
}
