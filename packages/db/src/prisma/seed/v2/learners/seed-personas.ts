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

/** The personas a test can copy, by the name `seedV2` returns them under. */
export type SeedPersonaName = (typeof SEED_PERSONA_NAMES)[number];

type PersonaContext = { edition: EnemEdition; now: Date };

/** Each persona by name; the exam and language ones depend on the day. */
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

/** The persona whose seed key is `key`: the first name the persona catalog calls them by, as "ana". */
export function findSeedPersonaName(key: string): SeedPersonaName | undefined {
  const now = new Date();
  const context = { edition: getPlannedEnemEdition(now), now };

  return SEED_PERSONA_NAMES.find((name) => PERSONAS[name](context).key === key);
}

/**
 * Every seed learner as plain data on a given day, without a database: the personas plus the
 * guest. Evals build their learner-context cases from these (Maya, Sam and the guest in English;
 * Ana, Lucas, Pedro and Marcos in Brazilian Portuguese), so tests, screenshots and evals share
 * the same learners.
 */
export function listSeedPersonas({ now }: { now: Date }): SeedLearner[] {
  const context = { edition: getPlannedEnemEdition(now), now };

  return [...Object.values(PERSONAS).map((build) => build(context)), guest];
}
