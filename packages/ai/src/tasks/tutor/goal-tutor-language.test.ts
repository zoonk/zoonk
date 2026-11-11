import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selectTutorLanguage } from "./goal-tutor-language";

const template = readFileSync(new URL("goal-tutor.prompt.md", import.meta.url), "utf8");

/** A name the app shows in each language, which no other language's instructions mention. */
const TODAY_TABS = {
  de: '"Heute"',
  en: '"Today"',
  es: '"Hoy"',
  fr: '"Aujourd’hui"',
  it: '"Oggi"',
  ja: '"今日"',
  ko: '"오늘"',
  pl: '"Dziś"',
  pt: '"Hoje"',
  tr: '"Bugün"',
} as const;

const LANGUAGES = Object.keys(TODAY_TABS) as (keyof typeof TODAY_TABS)[];

describe(selectTutorLanguage, () => {
  it.each(LANGUAGES)("gives a %s learner the app's names in that language alone", (language) => {
    const prompt = selectTutorLanguage({ language, template, variety: false });

    const others = LANGUAGES.filter((other) => other !== language).map(
      (other) => TODAY_TABS[other],
    );

    expect(prompt).toContain(TODAY_TABS[language]);
    expect(others.filter((name) => prompt.includes(name))).toStrictEqual([]);
    expect(prompt).not.toContain("{{");
  });

  it("names the learner's language as the answer's", () => {
    const prompt = selectTutorLanguage({ language: "pt", template, variety: false });

    expect(prompt).toContain("Answer in Português Brasileiro, the language the app shows them");
  });

  it("gives the variety's rules only to a learner who chose a country", () => {
    const chosen = selectTutorLanguage({ language: "en", template, variety: true });
    const none = selectTutorLanguage({ language: "en", template, variety: false });

    expect(chosen).toContain("`goal.variety.chosen`");
    expect(none).not.toContain("goal.variety");
  });

  it("names nothing in a language the app doesn't show", () => {
    const prompt = selectTutorLanguage({ language: "ar", template, variety: false });

    expect(LANGUAGES.filter((language) => prompt.includes(TODAY_TABS[language]))).toStrictEqual([]);
  });
});
