import { getModelById } from "./models";
import { type BattleMatchup, type ModelRanking } from "./types";

type BattleModelMapping = Pick<ModelRanking, "anonymousId" | "modelId">;

export function normalizeAnonymousId(anonymousId: string): string {
  return anonymousId
    .trim()
    .replace(/^model[\s_-]*/iu, "")
    .replace(/:$/u, "")
    .trim()
    .toUpperCase();
}

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
