import { type Goal, type TransactionClient } from "@zoonk/db";
import { isCountryCode } from "@zoonk/utils/countries";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { readCourseStart } from "../course-start-details";
import { type GoalDraft } from "../goal-contract";

type CountrySource = "said" | "home" | "picked" | "default";

function readStoredGoal({ draft, understanding }: { draft: GoalDraft; understanding: unknown }) {
  if (!isJsonObject(understanding) || !Array.isArray(understanding.goals)) {
    return null;
  }

  return understanding.goals.find((goal) => {
    if (!isJsonObject(goal) || !isJsonObject(goal.draft)) {
      return false;
    }

    return goal.draft.kind === draft.kind && goal.draft.title === draft.title;
  });
}

function requestedCountrySource({
  country,
  understood,
}: {
  country: string | null;
  understood: unknown;
}): CountrySource {
  const shown =
    isJsonObject(understood) && isJsonObject(understood.contentCountry)
      ? understood.contentCountry
      : null;

  if (shown?.code !== country) {
    return "picked";
  }

  const source = shown.source;
  return source === "said" || source === "home" || source === "default" ? source : "picked";
}

function getOnboardingId(draft: GoalDraft): string | null {
  const id = draft.details?.onboardingId;
  return typeof id === "string" && isUuid(id) ? id : null;
}

export async function resolveNewGoalCountry({
  draft,
  tx,
  userId,
}: {
  draft: GoalDraft;
  tx: TransactionClient;
  userId: string;
}): Promise<{
  contentCountry: string | null;
  countryDependent: boolean | null;
  source: CountrySource;
}> {
  if (draft.kind !== "learn") {
    return { contentCountry: null, countryDependent: null, source: "default" };
  }

  if (draft.primaryCourseId && readCourseStart(draft.details ?? {})) {
    const course = await tx.course.findUniqueOrThrow({ where: { id: draft.primaryCourseId } });

    return {
      contentCountry: course.country,
      countryDependent: course.country ? true : null,
      source: "picked",
    };
  }

  const onboardingId = getOnboardingId(draft);

  const [stored, profile] = await Promise.all([
    onboardingId ? tx.onboardingDraft.findFirst({ where: { id: onboardingId, userId } }) : null,
    tx.userLearningProfile.findUnique({ where: { userId } }),
  ]);

  const understood = readStoredGoal({ draft, understanding: stored?.understanding });

  const countryDependent =
    isJsonObject(understood) && typeof understood.countryDependent === "boolean"
      ? understood.countryDependent
      : null;

  if (draft.contentCountry !== undefined) {
    return {
      contentCountry: draft.contentCountry,
      countryDependent,
      source: requestedCountrySource({ country: draft.contentCountry, understood }),
    };
  }

  const saved =
    isJsonObject(understood) && isJsonObject(understood.draft)
      ? understood.draft.contentCountry
      : null;

  if (typeof saved === "string" && isCountryCode(saved)) {
    return { contentCountry: saved, countryDependent, source: "said" };
  }

  return {
    contentCountry: profile?.homeCountry ?? null,
    countryDependent,
    source: profile?.homeCountry ? "home" : "default",
  };
}

export function getGoalContentCountry({
  goal,
  existingCountry,
}: {
  existingCountry?: string | null;
  goal: Pick<Goal, "kind" | "contentCountry" | "details">;
}): string | null {
  if (goal.kind === "learn" && isJsonObject(goal.details)) {
    if (goal.details.countryDependent === false) {
      return null;
    }

    if (goal.details.countryDependent === true) {
      return goal.contentCountry;
    }
  }

  return goal.contentCountry ?? existingCountry ?? null;
}

export function hasCountryReading(goal: Pick<Goal, "details">): boolean {
  return isJsonObject(goal.details) && typeof goal.details.countryDependent === "boolean";
}

export function isCountryGoal(goal: Pick<Goal, "kind" | "details">): boolean {
  return (
    goal.kind === "learn" &&
    (!isJsonObject(goal.details) || goal.details.countryDependent !== false)
  );
}
