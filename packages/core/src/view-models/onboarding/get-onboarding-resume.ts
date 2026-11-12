import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { io } from "next/cache";
import { hasUnpickedChoice } from "../../exams/choices/load-exam-choices";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { findLearningProfileView } from "../../profile/_utils/learning-profile-view";
import { type LearningProfileView } from "../../profile/learning-profile-contract";
import { getSession } from "../../users/get-session";
import { type ResumeDraft, findResumeDraft } from "./_utils/resume-draft";
import { type OnboardingResumeView } from "./onboarding-contract";
import { getOnboardingSteps, hasOnboardingQuestions, isPlanRevealOwed } from "./onboarding-steps";

export type OnboardingResumeResult =
  | { resume: OnboardingResumeView | null; status: "ready" }
  | { status: "unauthorized" };

type ResumeGoal = Pick<
  Goal,
  | "details"
  | "examBlueprintId"
  | "id"
  | "kind"
  | "planRevealedAt"
  | "replacesGoalId"
  | "status"
  | "targetDate"
  | "title"
>;

function readDetails(goal: ResumeGoal): Record<string, unknown> {
  return isJsonObject(goal.details) ? goal.details : {};
}

function readOnboardingId(goal: ResumeGoal): string | null {
  const { onboardingId } = readDetails(goal);
  return typeof onboardingId === "string" ? onboardingId : null;
}

/** Onboarding ends when the learner presses the plan reveal's action; quick explanations have none. */
async function isInOnboarding({
  goal,
  goals,
  profile,
}: {
  goal: ResumeGoal;
  goals: ResumeGoal[];
  profile: LearningProfileView;
}): Promise<boolean> {
  if (isPlanRevealOwed(goal)) {
    return true;
  }

  const onboardingId = readOnboardingId(goal);

  const steps = getOnboardingSteps({
    goal: {
      details: readDetails(goal),
      hasUnpickedChoice: await hasUnpickedChoice(goal),
      kind: goal.kind,
      planRevealed: goal.planRevealedAt !== null,
      replacesGoalId: goal.replacesGoalId,
      targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    },
    profile: {
      hasBuddy: profile.buddy.picked,
      hasEarlierGoals: goals.some(
        (other) =>
          other.id !== goal.id &&
          (onboardingId === null || readOnboardingId(other) !== onboardingId),
      ),
    },
  });

  return hasOnboardingQuestions(steps);
}

/** A draft newer than every goal comes first; otherwise resume the newest unfinished onboarding or the day. */
async function toResume({
  draft,
  goals,
  profile,
}: {
  draft: ResumeDraft | null;
  goals: ResumeGoal[];
  profile: LearningProfileView;
}): Promise<OnboardingResumeView | null> {
  if (draft) {
    return { ...draft, kind: "draft" };
  }

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const latest = activeGoals.find((goal) => goal.kind !== "explain");

  if (latest && (await isInOnboarding({ goal: latest, goals, profile }))) {
    return { goalId: latest.id, kind: "goal", title: latest.title };
  }

  return activeGoals.length > 0 ? { kind: "today" } : null;
}

/** Resolves the session's continuation fresh at request time; callers may cache the complete display view. */
export async function getOnboardingResume(): Promise<OnboardingResumeResult> {
  await io();
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const [draft, goals, profile] = await Promise.all([
    findResumeDraft(userId),
    prisma.goal.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        details: true,
        examBlueprintId: true,
        id: true,
        kind: true,
        planRevealedAt: true,
        replacesGoalId: true,
        status: true,
        targetDate: true,
        title: true,
      },
      where: { userId },
    }),
    findLearningProfileView({ userId }),
  ]);

  return { resume: await toResume({ draft, goals, profile }), status: "ready" };
}
