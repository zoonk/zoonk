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
