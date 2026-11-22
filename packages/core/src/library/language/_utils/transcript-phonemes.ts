import { getBaseLanguage } from "@zoonk/utils/languages";

const CHECKED_LANGUAGES = new Set([
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "fr",
  "hi",
  "it",
  "nl",
  "no",
  "nb",
  "pl",
  "pt",
  "ru",
  "sv",
  "vi",
]);

const SCRIPT_FOR_LANGUAGE: Readonly<Record<string, RegExp>> = {
  el: /\p{Script=Greek}/u,
  hi: /\p{Script=Devanagari}/u,
  ru: /\p{Script=Cyrillic}/u,
};

type Phonemizer = { phonemizeToString: (text: string, voice: string) => string[] | null };

export function hasMatchingPhonemes({
  expected,
  heard,
  language,
}: {
  expected: string;
  heard: string;
  language: string;
}): boolean {
  const base = getBaseLanguage(language);

  if (!CHECKED_LANGUAGES.has(base)) {
    return false;
  }

  const script = SCRIPT_FOR_LANGUAGE[base] ?? /\p{Script=Latin}/u;
  const letters = (expected + heard).match(/\p{L}/gu);

  if (!letters?.every((letter) => script.test(letter))) {
    return false;
  }

  // The WASM runtime reads dictionaries relative to its installed package.
  const { createRequire } = process.getBuiltinModule("node:module");
  const require = createRequire(import.meta.url);
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- The package exports this synchronous API without TypeScript declarations.
  const phonemizer: Phonemizer = require("piper-phonemize");
  const requestedVoice = language.toLowerCase();
  const localReading = phonemizer.phonemizeToString(expected, requestedVoice);
  const baseVoice = base === "no" ? "nb" : base;
  const voice = localReading ? requestedVoice : baseVoice;
  const target = localReading ?? phonemizer.phonemizeToString(expected, voice);

  if (!target) {
    return false;
  }

  const key = (clauses: string[]) => {
    const ipa = clauses.join(" ");
    return base === "cs" ? ipa.replaceAll("ˈ", "") : ipa;
  };

  const reading = key(target);
  const transcript = phonemizer.phonemizeToString(heard, voice);
  return Boolean(transcript && /\p{L}/u.test(reading) && reading === key(transcript));
}
