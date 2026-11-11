import { collectJsonStrings } from "./json";
import { getBaseLanguage } from "./languages";

/**
 * Common words that are no word at all without their accents, here or in a language practiced beside
 * it, so "tres", "mas", "voces", "mochte" and "eleve" stay out. Models that drop accents drop them
 * everywhere, so a few frequent words catch it.
 */
const ACCENTLESS_WORDS: Readonly<Record<string, ReadonlySet<string>>> = {
  de: new Set([
    "gesprach",
    "horen",
    "konnen",
    "madchen",
    "moglich",
    "mussen",
    "naturlich",
    "prufung",
    "satze",
    "schuler",
    "spater",
    "uben",
    "ubung",
    "ubungen",
    "wahrend",
    "zuruck",
  ]),
  es: new Set(["algun", "ademas", "despues", "dificil", "facil", "ningun", "segun", "tambien"]),
  fr: new Set([
    "apres",
    "derniere",
    "deuxieme",
    "ecrire",
    "egalement",
    "etait",
    "etape",
    "etapes",
    "ete",
    "etre",
    "francais",
    "francaise",
    "maniere",
    "probleme",
    "problemes",
    "regle",
    "reponse",
    "reponses",
    "systeme",
    "troisieme",
  ]),
  it: new Set([
    "affinche",
    "attivita",
    "citta",
    "cosi",
    "gia",
    "perche",
    "piu",
    "poiche",
    "possibilita",
    "puo",
    "qualita",
  ]),
  pl: new Set([
    "bedzie",
    "cwiczenie",
    "dziekuje",
    "jestes",
    "jezyk",
    "jezyka",
    "ktora",
    "ktore",
    "ktory",
    "moze",
    "mozesz",
    "prosze",
    "rowniez",
    "slowa",
    "slowo",
    "sprobuj",
    "takze",
    "wiecej",
  ]),
  pt: new Set([
    "alem",
    "apos",
    "dificil",
    "disponivel",
    "entao",
    "estao",
    "facil",
    "impossivel",
    "nao",
    "porem",
    "possivel",
    "tambem",
    "voce",
  ]),
  tr: new Set([
    "cok",
    "cumle",
    "cunku",
    "degil",
    "dogru",
    "guzel",
    "icin",
    "konusma",
    "ogrenci",
    "ozellikle",
    "sekilde",
    "simdi",
    "soyle",
    "turkce",
  ]),
};

/** Endings no word has without the accent: Portuguese "-ção", "-ções", "-ssão", Spanish "-ción". */
const ACCENTLESS_ENDINGS: Readonly<Record<string, RegExp>> = {
  es: /^[a-z]{3,}cion$/u,
  pt: /^[a-z]{2,}(?:cao|coes|ssao|ssoes)$/u,
};

/** Composite codes `Intl` gives for scripts written with more than one Unicode script. */
const WRITING_SYSTEMS: Readonly<Record<string, readonly string[]>> = {
  Hans: ["Hani"],
  Hant: ["Hani"],
  Jpan: ["Hani", "Hira", "Kana"],
  Kore: ["Hang", "Hani"],
};

/**
 * Latin carries names, codes and units in every language, and Greek letters are math and science
 * symbols ("π", "Δ"). Common and Inherited cover digits, punctuation and combining marks.
 */
const SHARED_SCRIPTS = ["Latn", "Grek", "Zyyy", "Zinh"];

const NON_LATIN_SCRIPTS = [
  "Arab",
  "Armn",
  "Beng",
  "Cyrl",
  "Deva",
  "Ethi",
  "Geor",
  "Gujr",
  "Guru",
  "Hang",
  "Hani",
  "Hebr",
  "Hira",
  "Kana",
  "Khmr",
  "Knda",
  "Laoo",
  "Mlym",
  "Mymr",
  "Orya",
  "Sinh",
  "Taml",
  "Telu",
  "Thaa",
  "Thai",
  "Tibt",
];

function findInputScripts(input: string): string[] {
  return NON_LATIN_SCRIPTS.filter((script) => new RegExp(`\\p{scx=${script}}`, "u").test(input));
}

const WORD = /[\p{L}\p{M}]+/gu;

/** One Latin word, key, slug or URL ("redacao", "regra-de-tres"): ids and codes, not prose. */
const UNSPACED_LATIN = /^[\p{scx=Latn}\p{N}\p{P}\p{S}]+$/u;

/**
 * Quoted, bracketed or code text may be spelled as someone else wrote it: a learner's line, a
 * term's original, a variable, a `{placeholder}` code fills in.
 */
const QUOTED =
  /`[^`\n]*`|\{[^{}\n]*\}|"[^"\n]*"|“[^”\n]*”|„[^“”\n]*[“”]|«[^»\n]*»|「[^」\n]*」|『[^』\n]*』|\([^()\n]*\)/gu;

function getScripts(language: string): readonly string[] {
  try {
    const { script } = new Intl.Locale(language).maximize();
    return script ? (WRITING_SYSTEMS[script] ?? [script]) : [];
  } catch {
    return [];
  }
}

/** `Intl` may name a script that no Unicode property matches, which a pattern can't use. */
function isScriptProperty(script: string): boolean {
  try {
    return Boolean(new RegExp(`\\p{scx=${script}}`, "u"));
  } catch {
    return false;
  }
}

function buildScriptPattern({
  input,
  languages,
}: {
  input: string;
  languages: readonly string[];
}): RegExp {
  const scripts = new Set([
    ...SHARED_SCRIPTS,
    ...languages.flatMap((code) => getScripts(code)),
    ...findInputScripts(input),
  ]);

  const classes = [...scripts].filter((script) => isScriptProperty(script));
  return new RegExp(`^[${classes.map((script) => `\\p{scx=${script}}`).join("")}]+$`, "u");
}

function isAccentless({ language, word }: { language: string; word: string }): boolean {
  const lower = word.toLowerCase();
  const words = ACCENTLESS_WORDS[language];
  const ending = ACCENTLESS_ENDINGS[language];

  return Boolean(words?.has(lower) || ending?.test(lower));
}

/**
 * `otherLanguages` are the ones the text may also be in, such as the practiced one. Words the
 * model's `input` has are spelled as given, and alphabets it has belong to the task.
 */
export function findLanguageFlaws({
  input,
  language,
  otherLanguages = [],
  value,
}: {
  input: string;
  language: string;
  otherLanguages?: readonly string[];
  value: unknown;
}): string[] {
  const base = getBaseLanguage(language);
  const scriptPattern = buildScriptPattern({ input, languages: [language, ...otherLanguages] });
  const given = new Set(input.toLowerCase().match(WORD));

  const words = collectJsonStrings(value)
    .filter((text) => !UNSPACED_LATIN.test(text.trim()))
    .flatMap((text) => text.replaceAll(QUOTED, " ").match(WORD) ?? []);

  const problems = words.flatMap((word) => {
    if (given.has(word.toLowerCase())) {
      return [];
    }

    if (!scriptPattern.test(word)) {
      return [`Has "${word}", a word in a script this language doesn't use.`];
    }

    return isAccentless({ language: base, word })
      ? [`Writes "${word}" without the accents it needs.`]
      : [];
  });

  return [...new Set(problems)];
}
