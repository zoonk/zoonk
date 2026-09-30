import { type EnemEdition, getEnemEdition } from "../library/enem/enem-edition";
import { buildAna } from "./personas/ana-exam";
import { guest } from "./personas/guest";
import { lucasFun } from "./personas/lucas-fun";
import { buildMarcos } from "./personas/marcos-language";
import { mayaHugeGoal } from "./personas/maya-huge-goal";
import { pedroMinor } from "./personas/pedro-minor";
import { samExplain } from "./personas/sam-explain";
import { type SeedLearner } from "./types";

/** The personas a test can copy, by the name `seedV2` returns them under. */
export type SeedPersonaName = "exam" | "explain" | "fun" | "hugeGoal" | "language" | "minor";

type PersonaContext = { edition: EnemEdition; now: Date };

/** Each persona by name; the exam and language ones depend on the day. */
const PERSONAS: Record<SeedPersonaName, (context: PersonaContext) => SeedLearner> = {
  exam: ({ edition, now }) => buildAna({ edition, now }),
  explain: () => samExplain,
  fun: () => lucasFun,
  hugeGoal: () => mayaHugeGoal,
  language: ({ now }) => buildMarcos({ now }),
  minor: () => pedroMinor,
};

export function buildPersona({ name, ...context }: PersonaContext & { name: SeedPersonaName }) {
  return PERSONAS[name](context);
}

/**
 * Every seed learner as plain data on a given day, without a database: the personas plus the
 * guest. Evals build their learner-context cases from these (Maya, Sam and the guest in English;
 * Ana, Lucas, Pedro and Marcos in Brazilian Portuguese), so tests, screenshots and evals share
 * the same learners.
 */
export function listSeedPersonas({ now }: { now: Date }): SeedLearner[] {
  const context = { edition: getEnemEdition(now), now };

  return [...Object.values(PERSONAS).map((build) => build(context)), guest];
}
