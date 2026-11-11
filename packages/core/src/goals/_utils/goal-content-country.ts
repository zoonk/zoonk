import { type TransactionClient } from "@zoonk/db";
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

  const onboardingId = draft.details?.onboardingId;

  const [stored, profile] = await Promise.all([
    typeof onboardingId === "string" && isUuid(onboardingId)
      ? tx.onboardingDraft.findFirst({ where: { id: onboardingId, userId } })
      : null,
    tx.userLearningProfile.findUnique({ where: { userId } }),
  ]);

  const understood = readStoredGoal({ draft, understanding: stored?.understanding });

  const countryDependent =
    isJsonObject(understood) && typeof understood.countryDependent === "boolean"
      ? understood.countryDependent
      : null;

  if (draft.contentCountry !== undefined) {
    return { contentCountry: draft.contentCountry, countryDependent, source: "picked" };
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
