import { type Goal, type TransactionClient } from "@zoonk/db";
import { isCountryCode } from "@zoonk/utils/countries";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
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

type NewGoalCountry = {
  contentCountry: string | null;
  countryDependent: boolean | null;
  source: CountrySource;
};

function readUnderstoodCountry(understood: unknown) {
  const countryDependent =
    isJsonObject(understood) && typeof understood.countryDependent === "boolean"
      ? understood.countryDependent
      : null;

  const saved =
    isJsonObject(understood) && isJsonObject(understood.draft)
      ? understood.draft.contentCountry
      : undefined;

  return { countryDependent, saved };
}

function isChosenCountry(country: unknown): country is string | null {
  return country === null || (typeof country === "string" && isCountryCode(country));
}

/**
 * An exam's country is the one the learner's words or pick gave, never their home: the home
 * country is only where they live, and anyone can sit another country's exam.
 */
function resolveExamCountry({
  draft,
  understood,
}: {
  draft: GoalDraft;
  understood: unknown;
}): NewGoalCountry {
  const { countryDependent, saved } = readUnderstoodCountry(understood);
  const chosen = draft.contentCountry === undefined ? saved : draft.contentCountry;
  const country = isChosenCountry(chosen) ? chosen : null;

  return {
    contentCountry: country,
    countryDependent,
    source: country ? requestedCountrySource({ country, understood }) : "default",
  };
}

async function readStoredUnderstanding({
  draft,
  tx,
  userId,
}: {
  draft: GoalDraft;
  tx: TransactionClient;
  userId: string;
}) {
  const onboardingId = getOnboardingId(draft);

  const stored = onboardingId
    ? await tx.onboardingDraft.findFirst({ where: { id: onboardingId, userId } })
    : null;

  return readStoredGoal({ draft, understanding: stored?.understanding });
}

export async function resolveNewGoalCountry({
  courseCountry,
  draft,
  tx,
  userId,
}: {
  courseCountry?: string | null;
  draft: GoalDraft;
  tx: TransactionClient;
  userId: string;
}): Promise<NewGoalCountry> {
  if (draft.kind === "exam" && courseCountry === undefined) {
    const understood = await readStoredUnderstanding({ draft, tx, userId });
    return resolveExamCountry({ draft, understood });
  }

  if (draft.kind !== "learn") {
    return { contentCountry: courseCountry ?? null, countryDependent: null, source: "default" };
  }

  if (courseCountry !== undefined) {
    return {
      contentCountry: courseCountry,
      countryDependent: courseCountry ? true : null,
      source: "picked",
    };
  }

  const [understood, profile] = await Promise.all([
    readStoredUnderstanding({ draft, tx, userId }),
    tx.userLearningProfile.findUnique({ where: { userId } }),
  ]);

  const { countryDependent, saved } = readUnderstoodCountry(understood);
  const chosen = draft.contentCountry === undefined ? saved : draft.contentCountry;

  if (isChosenCountry(chosen)) {
    return {
      contentCountry: chosen,
      countryDependent,
      source: requestedCountrySource({ country: chosen, understood }),
    };
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

/** A learn goal unless its reading found it the same everywhere; an exam only when its reading found it varies by country. */
export function isCountryGoal(goal: Pick<Goal, "kind" | "details">): boolean {
  const countryDependent = isJsonObject(goal.details) ? goal.details.countryDependent : undefined;

  switch (goal.kind) {
    case "learn":
      return countryDependent !== false;
    case "exam":
      return countryDependent === true;
    case "explain":
    case "language":
      return false;
    default:
      return false;
  }
}
