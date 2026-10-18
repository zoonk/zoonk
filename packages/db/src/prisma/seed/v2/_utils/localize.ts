import { type Prisma } from "../../../../generated/prisma/client";

/** Library content is written once in both languages, so numbers and structure never drift apart. */
export const SEED_LANGUAGES = ["en", "pt"] as const;

export type SeedLanguage = (typeof SEED_LANGUAGES)[number];

/** Text in the languages a piece of content is written in. */
export class Localized {
  readonly #texts: Partial<Record<SeedLanguage, string>>;

  constructor(texts: Partial<Record<SeedLanguage, string>>) {
    this.#texts = texts;
  }

  /** The text in one language; asking for a language the content isn't written in is a seed bug. */
  in(language: SeedLanguage): string {
    const text = this.#texts[language];

    if (text === undefined) {
      throw new Error(`Seed text has no "${language}" version: ${JSON.stringify(this.#texts)}`);
    }

    return text;
  }
}

/** Text in English and Brazilian Portuguese. */
export function t(english: string, portuguese: string): Localized {
  return new Localized({ en: english, pt: portuguese });
}

/** Text only Portuguese speakers read, like the explanations of a course that teaches English. */
export function pt(text: string): Localized {
  return new Localized({ pt: text });
}

/** JSON whose text can be `Localized`: step content, item content and blueprint sections. */
type LocalizedJson =
  | string
  | number
  | boolean
  | null
  | Localized
  | readonly LocalizedJson[]
  | LocalizedObject;

export type LocalizedObject = { readonly [key: string]: LocalizedJson | undefined };

function isList(value: LocalizedJson): value is readonly LocalizedJson[] {
  return Array.isArray(value);
}

function localizeValue(value: LocalizedJson, language: SeedLanguage): Prisma.InputJsonValue | null {
  if (value instanceof Localized) {
    return value.in(language);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (isList(value)) {
    return value.map((item) => localizeValue(item, language));
  }

  return localizeObject(value, language);
}

/** Picks one language everywhere in a JSON object; undefined keys are left out. */
export function localizeObject(
  value: LocalizedObject,
  language: SeedLanguage,
): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      item === undefined ? [] : [[key, localizeValue(item, language)]],
    ),
  );
}
