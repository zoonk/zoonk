import { getExtracted } from "next-intl/server";
import { type HeroExample, toSteps } from "./hero-example";
import { getLondonTopics, getMexicoCityTopics } from "./hero-move-topics";

export async function getLondonExample(): Promise<HeroExample> {
  const t = await getExtracted();

  const day = {
    flat: t({
      description: "A topic for learning English before moving to London.",
      message: "Renting a flat",
    }),
    phrasalVerbs: t("Phrasal verbs"),
    presentPerfect: t("Present perfect"),
    th: t({
      description: "A pronunciation topic for learners of English.",
      message: "Pronouncing “th”",
    }),
  };

  return {
    file: t({
      description:
        "A spreadsheet's file name. Translate the words and keep the underscores and “.xlsx”.",
      message: "english_routine.xlsx",
    }),
    label: t("Everything there is to study in English"),
    moreTabs: 15,
    name: t({ description: "Use your language's name for London.", message: "English for London" }),
    search: t({
      description:
        "What someone types into a search engine: casual, lowercase, no final punctuation.",
      message: "how to learn english fast to move abroad",
    }),
    steps: toSteps([
      {
        detail: t("Conversation"),
        kind: "conversation",
        minutes: 10,
        title: day.flat,
        topic: day.flat,
      },
      {
        detail: t("Grammar"),
        kind: "lesson",
        minutes: 8,
        title: day.presentPerfect,
        topic: day.presentPerfect,
      },
      {
        detail: t("Quick review"),
        kind: "review",
        minutes: 4,
        title: day.phrasalVerbs,
        topic: day.phrasalVerbs,
      },
      { detail: t("Pronunciation"), kind: "lesson", minutes: 8, title: day.th, topic: day.th },
    ]),
    suggestions: [
      t({
        description: "A search engine's suggestion: casual, lowercase, as short as the English.",
        message: "english in 5 months, is it possible",
      }),
      t({
        description: "A search engine's suggestion: casual, lowercase, as short as the English.",
        message: "english for moving abroad",
      }),
    ],
    tabs: [
      t({
        description:
          "A browser tab's title for an English video, as short as the English: a phone shows it beside another tab.",
        message: "50 phrasal verbs",
      }),
      t({
        description:
          "A browser tab's title for an English video, as short as the English: a phone shows it beside another tab.",
        message: "British accent",
      }),
    ],
    topics: await getLondonTopics(day),
  };
}

export async function getMexicoCityExample(): Promise<HeroExample> {
  const t = await getExtracted();

  const day = {
    apartment: t({
      description: "A topic for learning Spanish before moving to Mexico City.",
      message: "Renting an apartment",
    }),
    preterite: t({ description: "A Spanish grammar topic.", message: "The preterite" }),
    rr: t({
      description: "A pronunciation topic for learners of Spanish.",
      message: "Rolling the “rr”",
    }),
    serEstar: t({
      description: "A Spanish grammar topic: keep “ser” and “estar” in Spanish.",
      message: "Ser and estar",
    }),
  };

  return {
    file: t({
      description:
        "A spreadsheet's file name. Translate the words and keep the underscores and “.xlsx”.",
      message: "spanish_routine.xlsx",
    }),
    label: t("Everything there is to study in Spanish"),
    moreTabs: 15,
    name: t({
      description: "An example goal's name. Use your language's name for Mexico City.",
      message: "Spanish for Mexico City",
    }),
    search: t({
      description:
        "What someone types into a search engine: casual, lowercase, no final punctuation.",
      message: "how to learn spanish fast to move abroad",
    }),
    steps: toSteps([
      {
        detail: t("Conversation"),
        kind: "conversation",
        minutes: 10,
        title: day.apartment,
        topic: day.apartment,
      },
      {
        detail: t("Grammar"),
        kind: "lesson",
        minutes: 8,
        title: day.serEstar,
        topic: day.serEstar,
      },
      {
        detail: t("Quick review"),
        kind: "review",
        minutes: 4,
        title: day.preterite,
        topic: day.preterite,
      },
      { detail: t("Pronunciation"), kind: "lesson", minutes: 8, title: day.rr, topic: day.rr },
    ]),
    suggestions: [
      t({
        description: "A search engine's suggestion: casual, lowercase, as short as the English.",
        message: "spanish in 5 months, is it possible",
      }),
      t({
        description: "A search engine's suggestion: casual, lowercase, as short as the English.",
        message: "spanish for moving abroad",
      }),
    ],
    tabs: [
      t({
        description:
          "A browser tab's title for a Spanish video, as short as the English: a phone shows it beside another tab.",
        message: "Verb conjugation",
      }),
      t({
        description:
          "A browser tab's title for a Spanish video, as short as the English: a phone shows it beside another tab.",
        message: "Mexican slang",
      }),
    ],
    topics: await getMexicoCityTopics(day),
  };
}
