import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { io } from "next/cache";
import { loadExamChoiceViews, loadExamChoices } from "../../exams/choices/load-exam-choices";
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

/** Newer goals supersede abandoned older drafts. */
const RECENT_DRAFTS = 5;

type ResumeGoal = Pick<
  Goal,
  "createdAt" | "details" | "examBlueprintId" | "id" | "kind" | "status" | "targetDate" | "title"
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

/** Created goals close a draft even after archival; non-goal routes already have their answer. */
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

/** Onboarding ends at the plan reveal; quick explanations have no onboarding. */
async function isInOnboarding({
  goal,
  goals,
  profile,
}: {
  goal: ResumeGoal;
  goals: ResumeGoal[];
  profile: LearningProfileView;
}): Promise<boolean> {
  const onboardingId = readOnboardingId(goal);

  const choices = await loadExamChoiceViews({
    choices: await loadExamChoices(goal.id),
    examBlueprintId: goal.examBlueprintId,
  });

  const steps = getOnboardingSteps({
    goal: {
      details: readDetails(goal),
      hasUnpickedChoice: choices.some((choice) => choice.subject === null),
      kind: goal.kind,
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

  return steps.some((step) => step !== "plan");
}

/** Drafts count only when newer than every goal; otherwise resume the newest unfinished onboarding or the day. */
async function toResume({
  draft,
  goals,
  profile,
}: {
  draft: ResumeDraft | null;
  goals: ResumeGoal[];
  profile: LearningProfileView;
}): Promise<OnboardingResumeView | null> {
  const [newest] = goals;

  if (draft && (!newest || draft.updatedAt > newest.createdAt)) {
    return { draftId: draft.id, kind: "draft", prompt: draft.prompt };
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
        examBlueprintId: true,
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
    resume: await toResume({ draft: findOpenDraft({ drafts, goals }), goals, profile }),
    status: "ready",
  };
}
