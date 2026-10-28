import { type Prisma } from "../../../../generated/prisma/client";

export const SEED_LANGUAGES = ["en", "pt"] as const;

export type SeedLanguage = (typeof SEED_LANGUAGES)[number];

export class Localized {
  readonly #texts: Partial<Record<SeedLanguage, string>>;

  constructor(texts: Partial<Record<SeedLanguage, string>>) {
    this.#texts = texts;
  }

  in(language: SeedLanguage): string {
    const text = this.#texts[language];

    if (text === undefined) {
      throw new Error(`Seed text has no "${language}" version: ${JSON.stringify(this.#texts)}`);
    }

    return text;
  }
}

export function t(english: string, portuguese: string): Localized {
  return new Localized({ en: english, pt: portuguese });
}

export function pt(text: string): Localized {
  return new Localized({ pt: text });
}

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
