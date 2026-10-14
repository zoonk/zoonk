import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getSession } from "../../users/get-session";
import { findLearnerLessonPlan } from "../_utils/learner-lesson-plan";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { type ChallengeTeam, buildChallengeTeam } from "./challenge-team";

type ChallengeTeamOutcome =
  | { status: "notFound" }
  | { status: "ready"; team: ChallengeTeam }
  | { status: "unauthorized" };

/**
 * The colleagues who play the role slots of a lesson's challenge for the signed-in learner (or
 * guest): the team kept with their plan, or names derived from its stable id in the lesson's
 * language. A learner without a plan gets a team picked from
 * their account, the same every time. A lesson that doesn't exist or isn't theirs to see is
 * `notFound`; without a session, colleagues go by role. Private cached, so a prefetched lesson
 * opens with its team. A read or prefetch never persists the deterministic fallback.
 */
export async function getChallengeTeam({
  lessonId,
}: {
  lessonId: string;
}): Promise<ChallengeTeamOutcome> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(lessonId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const lesson = await prisma.lesson.findFirst({
    select: { language: true },
    where: { ...libraryRowsVisibleTo(userId), id: lessonId },
  });

  if (!lesson) {
    return { status: "notFound" };
  }

  const plan = await findLearnerLessonPlan({ lessonId, userId });

  if (!plan) {
    return {
      status: "ready",
      team: buildChallengeTeam({ language: lesson.language, seed: userId }),
    };
  }

  const stored = parsePlanSettings(plan.settings).team;

  if (stored) {
    return { status: "ready", team: stored };
  }

  return {
    status: "ready",
    team: buildChallengeTeam({ language: lesson.language, seed: plan.id }),
  };
}
