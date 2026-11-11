import "server-only";
import { type GoalUnderstanding } from "@zoonk/ai/tasks/goals/understand-goal";
import { type OnboardingDraft, type TransactionClient, prisma } from "@zoonk/db";
import { getLanguageCountry } from "@zoonk/utils/countries";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { after } from "next/server";
import {
  type AnalyticsGoalKind,
  type AnalyticsPlatform,
} from "../../../analytics/shared-properties";
import { trackLearnerEvents } from "../../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getOnboardingDraftsCacheTag } from "../../../cache/tags";
import { countActiveGoalsLeft } from "../../../entitlements/_utils/active-goals-left";
import { readEntitlementViewer } from "../../../entitlements/_utils/entitlement-viewer";
import { toContentCountryView } from "../../../goals/_utils/content-country-view";
import {
  getCountrySuggestions,
  loadRecentCountries,
} from "../../../goals/_utils/country-suggestions";
import { defaultDisplayName } from "../../../goals/_utils/goal-display-name";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { getRequestInstant } from "../../../learner/facts/request-instant";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { withPlannableDate } from "../../../plans/target-date-range";
import { type GoalUnderstandingView, type OnboardingDraftView } from "../onboarding-contract";
import { goalUnderstandingViewSchema } from "../onboarding-view-schemas";
import { type FoundExam } from "./exam-facts";
import { getLearnerToday, getUnderstoodAim, toUnderstandingView } from "./understanding-view";

/** The learner's own draft; another learner's reads as missing. */
export async function findOwnedDraft({
  draftId,
  userId,
}: {
  draftId: string;
  userId: string;
}): Promise<OnboardingDraft | null> {
  if (!isUuid(draftId)) {
    return null;
  }

  return prisma.onboardingDraft.findFirst({ where: { id: draftId, userId } });
}

/** Excludes archived goals even when they retain details.onboardingId. */
export async function findDraftGoalId(
  draft: Pick<OnboardingDraft, "id" | "userId">,
  client: TransactionClient = prisma,
) {
  const goal = await client.goal.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: {
      details: { equals: draft.id, path: ["onboardingId"] },
      status: { not: "archived" },
      userId: draft.userId,
    },
  });

  return goal?.id ?? null;
}

/** A stored understanding is read back through its contract, so an old shape can't leak out. */
export function parseStoredUnderstanding(value: unknown): GoalUnderstandingView | null {
  const parsed = goalUnderstandingViewSchema.safeParse(value).data;

  if (!parsed || parsed.status !== "goals") {
    return parsed ?? null;
  }

  return {
    ...parsed,
    goals: parsed.goals.map((goal) => ({
      ...goal,
      draft: {
        ...goal.draft,
        displayName: goal.draft.displayName ?? defaultDisplayName(goal.draft),
      },
    })),
  };
}

/** On read, not when the card is saved: a card's date can become today overnight, and its aim's choices follow the level. */
function withPlannableDates({
  today,
  understanding,
}: {
  today: string;
  understanding: GoalUnderstandingView;
}): GoalUnderstandingView {
  if (understanding.status !== "goals") {
    return understanding;
  }

  return {
    ...understanding,
    goals: understanding.goals.map((goal) => ({
      ...goal,
      draft: withPlannableDate({ draft: goal.draft, today }),
      languageAim: getUnderstoodAim(goal.draft),
    })),
  };
}

async function withDraftCountries({
  understanding,
  userId,
}: {
  understanding: GoalUnderstandingView | null;
  userId: string;
}): Promise<GoalUnderstandingView | null> {
  if (understanding?.status !== "goals") {
    return understanding;
  }

  const [profile, recent, blueprints] = await Promise.all([
    prisma.userLearningProfile.findUnique({ where: { userId } }),
    loadRecentCountries(userId),
    prisma.examBlueprint.findMany({
      select: { country: true, id: true },
      where: {
        id: { in: understanding.goals.flatMap((goal) => goal.draft.examBlueprintId ?? []) },
      },
    }),
  ]);

  return {
    ...understanding,
    goals: understanding.goals.map((goal) => {
      const { language } = goal.draft;

      const examCode =
        blueprints.find((row) => row.id === goal.draft.examBlueprintId)?.country ?? null;

      const exam =
        goal.draft.kind === "exam" && examCode !== getLanguageCountry(language)
          ? toContentCountryView({
              code: examCode,
              editable: false,
              kind: "exam",
              language,
              source: "said",
            })
          : null;

      return {
        ...goal,
        contentCountry: goal.draft.kind === "exam" ? exam : (goal.contentCountry ?? null),
        suggested: getCountrySuggestions({
          homeCountry: profile?.homeCountry ?? null,
          language,
          recent,
        }),
      };
    }),
  };
}

/** The lock follows the learner's plan and goals as they are now, so subscribing or pausing a goal unlocks more of the card. */
export async function toDraftView({
  draft,
  goalId,
}: {
  draft: OnboardingDraft;
  goalId: string | null;
}): Promise<OnboardingDraftView> {
  const stored =
    draft.status === "understood" ? parseStoredUnderstanding(draft.understanding) : null;

  const [viewer, now] = await Promise.all([readEntitlementViewer(), getRequestInstant()]);
  const today = toIsoDate(getDateInTimeZone({ date: now, timeZone: draft.timeZone }));

  const understanding = await withDraftCountries({
    understanding: stored && withPlannableDates({ today, understanding: stored }),
    userId: draft.userId,
  });

  const activeGoalsLeft = await countActiveGoalsLeft({
    tier: viewer?.tier ?? "guest",
    userId: draft.userId,
  });

  return {
    activeGoalsLeft,
    generationId: draft.runId,
    goalId,
    id: draft.id,
    prompt: draft.prompt,
    // An unreadable stored understanding must be retried rather than exposed as understood.
    status: draft.status === "understood" && !understanding ? "failed" : draft.status,
    timeZone: draft.timeZone,
    understanding,
  };
}

export async function loadDraftView(draft: OnboardingDraft): Promise<OnboardingDraftView> {
  return toDraftView({ draft, goalId: await findDraftGoalId(draft) });
}

/** Persists the card using the draft's learner-local today and carries its identity into each goal. */
export async function completeDraft({
  draft,
  exams,
  understanding,
  platform,
}: {
  draft: Pick<OnboardingDraft, "id" | "language" | "prompt" | "timeZone" | "userId">;
  exams: readonly (FoundExam | null)[];
  understanding: GoalUnderstanding;
  platform?: AnalyticsPlatform | null;
}): Promise<OnboardingDraft> {
  const profile = await prisma.userLearningProfile.findUnique({ where: { userId: draft.userId } });

  const view = await toUnderstandingView({
    context: {
      goal: draft.prompt,
      homeCountry: profile?.homeCountry ?? null,
      language: draft.language,
      onboardingId: draft.id,
      today: getLearnerToday(draft.timeZone),
    },
    exams,
    understanding,
  });

  const saved = await writeLearnerChange({ userId: draft.userId }, async (tx) => {
    const { count } = await tx.onboardingDraft.updateMany({
      data: { status: "understood", understanding: view },
      where: {
        NOT: { status: "understood", understanding: { equals: view } },
        id: draft.id,
        userId: draft.userId,
      },
    });

    const current = await tx.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });
    const outcome = { changed: count > 0, draft: current };
    return count === 0 ? unchanged(outcome) : outcome;
  });

  if (saved.changed) {
    revalidateCacheTags([getOnboardingDraftsCacheTag(draft.userId)]);
    const at = Date.now();

    after(() =>
      trackLearnerEvents({
        events: [
          {
            name: "Goal Classified",
            properties: {
              at,
              duration_ms: Math.max(0, at - saved.draft.createdAt.getTime()),
              onboarding_id: draft.id,
              result: getClassifiedKind(view),
            },
          },
        ],
        locale: draft.language,
        platform,
        userId: draft.userId,
      }),
    );
  }

  return saved.draft;
}

function getClassifiedKind(understanding: GoalUnderstandingView): AnalyticsGoalKind | "declined" {
  switch (understanding.status) {
    case "goals":
      return understanding.goals[0]?.draft.kind ?? "learn";
    case "explain":
      return "explain";
    case "instrument":
      return "learn";
    case "unclear":
    case "unsafe":
      return "declined";
    default:
      return "declined";
  }
}
