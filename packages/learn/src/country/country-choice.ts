import { type LessonVariety } from "./use-country-lines";

/** A country as core names it in the learner's language, with the variety lessons use there. */
export type CountryChoice = {
  code: string;
  /** Set only where the language has another variety, so its lessons' wording could surprise. */
  lessonVariety?: LessonVariety | null;
  name: string;
};

export type SuggestedCountry = CountryChoice & { tag: "home" | null };
