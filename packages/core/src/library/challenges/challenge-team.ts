import { type SupportedLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { hashSeed } from "@zoonk/utils/seeded-random";
import { z } from "zod";
import { type ChallengeTeamSlot } from "../steps/contract/challenge-content";
import { CHALLENGE_NAME_PATTERN } from "./challenge-graph";

const MAX_TEAM = 4;
const MAX_NAME_LENGTH = 40;

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

const TEAM_NAMES: Readonly<Record<SupportedLocale, readonly string[]>> = {
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
  it: [
    "Giulia",
    "Matteo",
    "Chiara",
    "Luca",
    "Fatima",
    "Andrea",
    "Sara",
    "Ahmed",
    "Elena",
    "Marco",
    "Aurora",
    "Davide",
  ],
  ja: [
    "美咲",
    "大輝",
    "結衣",
    "拓海",
    "さくら",
    "翔太",
    "マリア",
    "健太",
    "美月",
    "悠斗",
    "陽菜",
    "蓮",
  ],
  ko: [
    "서연",
    "민준",
    "지은",
    "현우",
    "하은",
    "도윤",
    "수아",
    "재민",
    "예린",
    "준호",
    "유나",
    "성민",
  ],
  pl: [
    "Zuzanna",
    "Jakub",
    "Maja",
    "Kacper",
    "Oksana",
    "Mateusz",
    "Natalia",
    "Bartek",
    "Julia",
    "Dmytro",
    "Aleksandra",
    "Piotr",
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
  tr: [
    "Elif",
    "Emre",
    "Zeynep",
    "Mert",
    "Ayşe",
    "Burak",
    "Defne",
    "Can",
    "Selin",
    "Kerem",
    "Rojda",
    "Baran",
  ],
};

/** Case role descriptions assume alternating genders, starting with a woman, so team names must match. */
export function buildChallengeTeam({
  language,
  seed,
}: {
  language: string;
  seed: string;
}): ChallengeTeam {
  const base = getSupportedLocaleFromLanguage(language);
  const names = TEAM_NAMES[base];
  const pairs = Math.max(1, Math.floor(names.length / 2));
  const start = (hashSeed(seed) % pairs) * 2;

  return {
    language: base,
    members: Array.from({ length: MAX_TEAM }, (_, index) => ({
      name: names[(start + index) % names.length] ?? "",
    })),
  };
}

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

export function fillChallengeNames(text: string, names: Readonly<Record<string, string>>): string {
  return text.replaceAll(CHALLENGE_NAME_PATTERN, (match, slotId: string) => names[slotId] ?? match);
}
