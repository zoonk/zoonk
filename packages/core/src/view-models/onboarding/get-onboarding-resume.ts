import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { findLearningProfileView } from "../../profile/_utils/learning-profile-view";
import { type LearningProfileView } from "../../profile/learning-profile-contract";
import { getSession } from "../../users/get-session";
import { parseStoredUnderstanding } from "./_utils/onboarding-draft";
import { type OnboardingResumeView } from "./onboarding-contract";
import { getOnboardingSteps } from "./onboarding-steps";

export type OnboardingResumeResult =
  | { resume: OnboardingResumeView | null; status: "ready" }
  | { status: "unauthorized" };

/** Only the latest few drafts matter: an older one was left for something newer. */
const RECENT_DRAFTS = 5;

type ResumeGoal = Pick<
  Goal,
  "createdAt" | "details" | "id" | "kind" | "status" | "targetDate" | "title"
>;

type ResumeDraft = {
  id: string;
  prompt: string;
  status: string;
  understanding: unknown;
  updatedAt: Date;
};

function readDetails(goal: ResumeGoal): Record<string, unknown> {
  return isJsonObject(goal.details) ? goal.details : {};
}

function readOnboardingId(goal: ResumeGoal): string | null {
  const { onboardingId } = readDetails(goal);
  return typeof onboardingId === "string" ? onboardingId : null;
}

/**
 * A draft is left to continue while its words are read, when they couldn't be, or while its goals
 * wait to be confirmed. Goals created from it, even ones archived since, close it; a question, an
 * instrument or a declined goal already had its answer.
 */
function findOpenDraft({ drafts, goals }: { drafts: ResumeDraft[]; goals: ResumeGoal[] }) {
  const closed = new Set(goals.map((goal) => readOnboardingId(goal)));

  return (
    drafts.find(
      (draft) =>
        !closed.has(draft.id) &&
        (draft.status !== "understood" ||
          parseStoredUnderstanding(draft.understanding)?.status === "goals"),
    ) ?? null
  );
}

/**
 * Whether a goal's onboarding still has screens before the plan: the plan's reveal, with its
 * "Start day 1", is where onboarding ends. Questions have no onboarding.
 */
function isInOnboarding({
  goal,
  goals,
  profile,
}: {
  goal: ResumeGoal;
  goals: ResumeGoal[];
  profile: LearningProfileView;
}): boolean {
  const onboardingId = readOnboardingId(goal);

  const steps = getOnboardingSteps({
    goal: {
      details: readDetails(goal),
      kind: goal.kind,
      targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    },
    profile: {
      experienceMode: profile.experienceMode,
      hasBirth: profile.birth !== null,
      hasBuddy: profile.buddy !== null,
      hasEarlierGoals: goals.some(
        (other) =>
          other.id !== goal.id &&
          (onboardingId === null || readOnboardingId(other) !== onboardingId),
      ),
    },
  });

  return steps.some((step) => step !== "plan");
}

/**
 * A draft only counts when it's newer than every goal: a draft left for a goal created later was
 * set aside. Then the newest goal (questions aside) while its onboarding runs, else the day.
 */
function toResume({
  draft,
  goals,
  profile,
}: {
  draft: ResumeDraft | null;
  goals: ResumeGoal[];
  profile: LearningProfileView;
}): OnboardingResumeView | null {
  const [newest] = goals;

  if (draft && (!newest || draft.updatedAt > newest.createdAt)) {
    return { draftId: draft.id, kind: "draft", prompt: draft.prompt };
  }

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const latest = activeGoals.find((goal) => goal.kind !== "explain");

  if (latest && isInOnboarding({ goal: latest, goals, profile })) {
    return { goalId: latest.id, kind: "goal", title: latest.title };
  }

  return activeGoals.length > 0 ? { kind: "today" } : null;
}

/**
 * What a returning visitor, guest or learner should continue: a goal they typed but haven't
 * confirmed yet, their newest goal while its onboarding hasn't reached the plan, or their day when
 * they have an active goal. Null when there's nothing to continue. Uncached: every step changes it.
 */
export async function getOnboardingResume(): Promise<OnboardingResumeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const [drafts, goals, profile] = await Promise.all([
    prisma.onboardingDraft.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, prompt: true, status: true, understanding: true, updatedAt: true },
      take: RECENT_DRAFTS,
      where: { userId },
    }),
    prisma.goal.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        details: true,
        id: true,
        kind: true,
        status: true,
        targetDate: true,
        title: true,
      },
      where: { userId },
    }),
    findLearningProfileView(userId),
  ]);

  return {
    resume: toResume({ draft: findOpenDraft({ drafts, goals }), goals, profile }),
    status: "ready",
  };
}
