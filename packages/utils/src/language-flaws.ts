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

/**
 * Endings no word has without the accent: Portuguese "-ção", "-ções", "-ssão", Spanish "-ción",
 * apart from English words that end the same way.
 */
const ACCENTLESS_ENDINGS: Readonly<Record<string, RegExp>> = {
  es: /^(?!(?:coer|s|suspi)cion$)[a-z]{3,}cion$/u,
  pt: /^[a-z]{2,}(?:cao|coes|ssao|ssoes)$/u,
};

/**
 * Real words of a practiced language that look like another's accentless ones, in the case they're
 * written in: Italian "voce" passes, but Portuguese "Voce" opening a sentence is still "Você".
 */
const WORDS_ELSEWHERE: Readonly<Record<string, ReadonlySet<string>>> = { it: new Set(["voce"]) };

/** Composite codes `Intl` gives for scripts written with more than one Unicode script. */
const WRITING_SYSTEMS: Readonly<Record<string, readonly string[]>> = {
  Hans: ["Hani"],
  Hant: ["Hani"],
  Jpan: ["Hani", "Hira", "Kana"],
  Kore: ["Hang", "Hani"],
};

/**
 * Latin carries names, codes and units in every language. Common and Inherited cover digits,
 * punctuation and combining marks.
 */
const SHARED_SCRIPTS = ["Latn", "Zyyy", "Zinh"];

const NON_LATIN_SCRIPTS = [
  "Arab",
  "Armn",
  "Beng",
  "Cyrl",
  "Deva",
  "Ethi",
  "Geor",
  "Grek",
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

/** One or two Greek letters are math or science symbols ("π", "Δθ"); a longer run is a Greek word. */
const GREEK_SYMBOL = /(?<!\p{scx=Grek})\p{scx=Grek}{1,2}(?!\p{scx=Grek})/gu;

/** A key, slug, enum or URL ("comunicacao", "regra-de-tres"): ids and codes, not prose. */
const IDENTIFIER = /^(?:https?:\/\/\S+|[a-z\d]+(?:[-_./][a-z\d]+)*)$/u;

/**
 * Quoted or code text may be spelled as someone else wrote it: a learner's line, a variable, a
 * `{placeholder}` code fills in.
 */
const QUOTED =
  /`[^`\n]*`|\{[^{}\n]*\}|"[^"\n]*"|“[^”\n]*”|„[^“”\n]*[“”]|«[^»\n]*»|「[^」\n]*」|『[^』\n]*』/gu;

/** Brackets hold a term in its original alphabet: "kaizen (改善)". */
const BRACKETED = /\([^()\n]*\)/gu;

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
  return new RegExp(`^[${classes.map((script) => `\\p{scx=${script}}`).join("")}]*$`, "u");
}

function isAccentless({
  language,
  otherLanguages,
  word,
}: {
  language: string;
  otherLanguages: readonly string[];
  word: string;
}): boolean {
  const lower = word.toLowerCase();
  const words = ACCENTLESS_WORDS[language];
  const ending = ACCENTLESS_ENDINGS[language];

  const elsewhere = otherLanguages.some((other) => WORDS_ELSEWHERE[other]?.has(word));

  return !elsewhere && Boolean(words?.has(lower) || ending?.test(lower));
}

/**
 * `otherLanguages` are the ones the text may also be in, such as the practiced one. A word the
 * model's `input` has, in the same form, is spelled as given, such as a learner's typed "nao"; an
 * alphabet it has belongs to the task.
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
  const [base = "", ...others] = [language, ...otherLanguages].map((code) => getBaseLanguage(code));
  const scriptPattern = buildScriptPattern({ input, languages: [language, ...otherLanguages] });
  const given = new Set(input.match(WORD));

  const unquoted = collectJsonStrings(value)
    .filter((text) => !IDENTIFIER.test(text.trim()))
    .map((text) => text.replaceAll(QUOTED, " "));

  const foreign = unquoted
    .flatMap((text) => text.replaceAll(BRACKETED, " ").match(WORD) ?? [])
    .filter((word) => !given.has(word) && !scriptPattern.test(word.replaceAll(GREEK_SYMBOL, "")))
    .map((word) => `Has "${word}", a word in a script this language doesn't use.`);

  const accentless = unquoted
    .flatMap((text) => text.match(WORD) ?? [])
    .filter(
      (word) => !given.has(word) && isAccentless({ language: base, otherLanguages: others, word }),
    )
    .map((word) => `Writes "${word}" without the accents it needs.`);

  return [...new Set([...foreign, ...accentless])];
}
