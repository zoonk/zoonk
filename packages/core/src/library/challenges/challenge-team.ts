import { getBaseLanguage } from "@zoonk/utils/languages";
import { hashSeed } from "@zoonk/utils/seeded-random";
import { z } from "zod";
import { type ChallengeTeamSlot } from "../steps/contract/challenge-content";
import { CHALLENGE_NAME_PATTERN } from "./challenge-graph";

const MAX_TEAM = 4;
const MAX_NAME_LENGTH = 40;

/**
 * The learner's colleagues in every challenge of a plan: up to four names, kept with the plan so
 * the same people show up across the course. Cases name colleagues by role; the team gives each
 * role slot a name when the case is played.
 */
export const challengeTeamSchema = z
  .object({
    language: z.string().meta({ description: "The language the names were picked for" }),
    members: z
      .array(z.object({ name: z.string().min(1).max(MAX_NAME_LENGTH) }))
      .min(1)
      .max(MAX_TEAM)
      .meta({ description: "In order: the case's first colleague by role is the first member" }),
  })
  .meta({ id: "ChallengeTeam" });

export type ChallengeTeam = z.infer<typeof challengeTeamSchema>;

/**
 * Diverse by design: every list alternates women and men from different backgrounds, starting with
 * a woman, so any four names in a row from an even place are a woman, a man, a woman and a man,
 * with different origins. Names fit the language the case is in.
 */
const TEAM_NAMES: Readonly<Record<string, readonly string[]>> = {
  de: [
    "Lena",
    "Deniz",
    "Sophie",
    "Jonas",
    "Amira",
    "Felix",
    "Mia",
    "Emre",
    "Hannah",
    "Kofi",
    "Aylin",
    "Lukas",
  ],
  en: [
    "Priya",
    "Marcus",
    "Sofia",
    "Daniel",
    "Aisha",
    "Kenji",
    "Elena",
    "Omar",
    "Grace",
    "Mateo",
    "Nadia",
    "Sam",
  ],
  es: [
    "Lucía",
    "Mateo",
    "Amina",
    "Javier",
    "Carmen",
    "Kenji",
    "Valentina",
    "Samuel",
    "Nuria",
    "Andrés",
    "Irene",
    "Omar",
  ],
  fr: [
    "Léa",
    "Karim",
    "Chloé",
    "Thomas",
    "Aïcha",
    "Hugo",
    "Camille",
    "Mamadou",
    "Inès",
    "Julien",
    "Sarah",
    "Nathan",
  ],
  pt: [
    "Sofia",
    "Rui",
    "Camila",
    "Tiago",
    "Yara",
    "Kenji",
    "Beatriz",
    "Omar",
    "Luana",
    "Diego",
    "Helena",
    "Caio",
  ],
};

const FALLBACK_LANGUAGE = "en";

function getTeamLanguage(language: string): string {
  const base = getBaseLanguage(language);
  return base in TEAM_NAMES ? base : FALLBACK_LANGUAGE;
}

/**
 * Picks four names in a row from the language's list, starting at the woman the seed (the plan's
 * id) points to, so every team is a woman, a man, a woman and a man in that order: cases are
 * written before anyone plays them, and they write each colleague's role in that gender
 * ("Pesquisadora de UX" for the first). No model is needed, and the same plan always gets the
 * same team, even if it's picked again.
 */
export function buildChallengeTeam({
  language,
  seed,
}: {
  language: string;
  seed: string;
}): ChallengeTeam {
  const base = getTeamLanguage(language);
  const names = TEAM_NAMES[base] ?? [];
  const pairs = Math.max(1, Math.floor(names.length / 2));
  const start = (hashSeed(seed) % pairs) * 2;

  return {
    language: base,
    members: Array.from({ length: MAX_TEAM }, (_, index) => ({
      name: names[(start + index) % names.length] ?? "",
    })),
  };
}

/**
 * The name each role slot goes by: the AI assistant by its role, and colleagues by the team's
 * names in order. Without a team, or past its size, a colleague goes by role.
 */
export function getChallengeNames({
  slots,
  team,
}: {
  slots: readonly ChallengeTeamSlot[];
  team: ChallengeTeam | null;
}): Record<string, string> {
  const people = slots.filter((slot) => !slot.ai);

  return Object.fromEntries(
    slots.map((slot) => {
      const index = people.indexOf(slot);
      const member = slot.ai || !team ? undefined : team.members[index];
      return [slot.id, member?.name ?? slot.role];
    }),
  );
}

/** Puts each colleague's name where the text says `{{slotId}}`. */
export function fillChallengeNames(text: string, names: Readonly<Record<string, string>>): string {
  return text.replaceAll(CHALLENGE_NAME_PATTERN, (match, slotId: string) => names[slotId] ?? match);
}
