import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { getSession } from "../../users/get-session";
import { findLearnerLessonPlan } from "../_utils/learner-lesson-plan";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { type ChallengeTeam, buildChallengeTeam } from "./challenge-team";

/**
 * Keeps the team with the plan the first time a challenge is played. Only a plan without a team
 * gets one, in one statement, so a concurrent settings change is never overwritten; the team is
 * picked from the plan's id, so a second request stores the same people.
 */
async function saveTeam({ planId, team }: { planId: string; team: ChallengeTeam }) {
  await prisma.$executeRaw`
    UPDATE plans
    SET settings = jsonb_set(settings, '{team}', ${JSON.stringify(team)}::jsonb)
    WHERE id = ${planId}::uuid
      AND COALESCE(settings -> 'team', 'null'::jsonb) = 'null'::jsonb
  `;
}

type ChallengeTeamOutcome =
  | { status: "notFound" }
  | { status: "ready"; team: ChallengeTeam }
  | { status: "unauthorized" };

/**
 * The colleagues who play the role slots of a lesson's challenge for the signed-in learner (or
 * guest): the team kept with their plan, created from a curated list of names in the lesson's
 * language when their first challenge is played. A learner without a plan gets a team picked from
 * their account, the same every time. A lesson that doesn't exist or isn't theirs to see is
 * `notFound`; without a session, colleagues go by role. Private cached, so a prefetched lesson
 * opens with its team; keeping the team the first time is idempotent, so a prefetch may do it.
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

  const team = buildChallengeTeam({ language: lesson.language, seed: plan.id });
  await saveTeam({ planId: plan.id, team });

  return { status: "ready", team };
}
