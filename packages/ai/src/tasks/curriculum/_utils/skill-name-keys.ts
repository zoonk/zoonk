import { normalizeString } from "@zoonk/utils/string";

const NAME_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "au",
  "aux",
  "da",
  "das",
  "de",
  "del",
  "der",
  "des",
  "die",
  "do",
  "dos",
  "du",
  "e",
  "el",
  "em",
  "en",
  "et",
  "for",
  "im",
  "in",
  "la",
  "las",
  "le",
  "les",
  "los",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "of",
  "on",
  "os",
  "the",
  "to",
  "um",
  "uma",
  "und",
  "von",
  "with",
  "y",
]);

export function toNameWords(name: string): string[] {
  return normalizeString(name)
    .replaceAll(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter((word) => word && !NAME_STOPWORDS.has(word));
}

/** Articles do not change an action; its words' order can change its direction. */
export function toSkillNameKey(name: string): string {
  return toNameWords(name).join(" ");
}

export function toSkillIdentityKey(skill: {
  libraryId?: string;
  name: string;
  subject?: string | null;
}): string {
  if (skill.libraryId) {
    return `library:${skill.libraryId}`;
  }

  const identity = toSkillNameKey(skill.name);
  return skill.subject ? JSON.stringify([skill.subject, identity]) : identity;
}
