import { getModelById } from "./models";
import { type BattleMatchup, type ModelRanking } from "./types";

type BattleModelMapping = Pick<ModelRanking, "anonymousId" | "modelId">;

/**
 * Judges may change the case or separator in an anonymous label even when the
 * prompt uses labels such as "Model A". Reducing harmless variants to the same
 * value keeps every judge attached to the model that received that label.
 */
export function normalizeAnonymousId(anonymousId: string): string {
  return anonymousId
    .trim()
    .replace(/^model[\s_-]*/iu, "")
    .replace(/:$/u, "")
    .trim()
    .toUpperCase();
}

/**
 * Uses rankings that already contain configured model IDs to recover the
 * anonymous mapping for older battle files. Earlier runs sometimes persisted
 * Opus labels such as "model_A" as model IDs, while other judges in the same
 * matchup retained the real anonymous-to-model relationship.
 */
function getBattleModelMappings(matchup: BattleMatchup): Map<string, BattleModelMapping> {
  const mappings = new Map<string, BattleModelMapping>();

  for (const judgment of matchup.judgments) {
    for (const ranking of judgment.rankings) {
      const normalizedAnonymousId = normalizeAnonymousId(ranking.anonymousId);

      if (
        normalizedAnonymousId &&
        getModelById(ranking.modelId) &&
        !mappings.has(normalizedAnonymousId)
      ) {
        mappings.set(normalizedAnonymousId, {
          anonymousId: ranking.anonymousId,
          modelId: ranking.modelId,
        });
      }
    }
  }

  return mappings;
}

/**
 * Reconnects one malformed historical ranking when another judge preserved the
 * real model ID for the same anonymous output.
 */
function resolveBattleRanking({
  mappings,
  ranking,
}: {
  mappings: Map<string, BattleModelMapping>;
  ranking: ModelRanking;
}): ModelRanking {
  if (getModelById(ranking.modelId)) {
    return ranking;
  }

  const mapping = mappings.get(normalizeAnonymousId(ranking.anonymousId));

  return mapping
    ? { ...ranking, anonymousId: mapping.anonymousId, modelId: mapping.modelId }
    : ranking;
}

/**
 * Repairs model IDs from historical judge results without changing valid
 * rankings. This lets existing leaderboards group every judge under the same
 * configured model instead of requiring the battle to be generated again.
 */
export function resolveBattleMatchupModelIds(matchup: BattleMatchup): BattleMatchup {
  const mappings = getBattleModelMappings(matchup);

  return {
    ...matchup,
    judgments: matchup.judgments.map((judgment) => ({
      ...judgment,
      rankings: judgment.rankings.map((ranking) => resolveBattleRanking({ mappings, ranking })),
    })),
  };
}
