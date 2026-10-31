import { type EnemEdition, getPlannedEnemEdition } from "../library/enem/enem-edition";
import { buildAna } from "./personas/ana-exam";
import { guest } from "./personas/guest";
import { lucasBuddy } from "./personas/lucas-buddy";
import { buildMarcos } from "./personas/marcos-language";
import { mayaHugeGoal } from "./personas/maya-huge-goal";
import { pedroStocks } from "./personas/pedro-stocks";
import { samExplain } from "./personas/sam-explain";
import { type SeedLearner } from "./types";

export const SEED_PERSONA_NAMES = [
  "buddy",
  "exam",
  "explain",
  "hugeGoal",
  "language",
  "stocks",
] as const;

export type SeedPersonaName = (typeof SEED_PERSONA_NAMES)[number];

type PersonaContext = { edition: EnemEdition; now: Date };

const PERSONAS: Record<SeedPersonaName, (context: PersonaContext) => SeedLearner> = {
  buddy: () => lucasBuddy,
  exam: ({ edition, now }) => buildAna({ edition, now }),
  explain: () => samExplain,
  hugeGoal: () => mayaHugeGoal,
  language: ({ now }) => buildMarcos({ now }),
  stocks: () => pedroStocks,
};

export function buildPersona({ name, ...context }: PersonaContext & { name: SeedPersonaName }) {
  return PERSONAS[name](context);
}

export function findSeedPersonaName(key: string): SeedPersonaName | undefined {
  const now = new Date();
  const context = { edition: getPlannedEnemEdition(now), now };

  return SEED_PERSONA_NAMES.find((name) => PERSONAS[name](context).key === key);
}

/** Evals build their learner-context cases from these, so tests and evals share the learners. */
export function listSeedPersonas({ now }: { now: Date }): SeedLearner[] {
  const context = { edition: getPlannedEnemEdition(now), now };

  return [...Object.values(PERSONAS).map((build) => build(context)), guest];
}
