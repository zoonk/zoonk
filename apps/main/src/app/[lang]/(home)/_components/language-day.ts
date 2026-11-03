import { type DayListStep } from "@/components/public/day-list";
import { getExtracted } from "next-intl/server";
import { toExampleSteps } from "./example-steps";
import { getExampleSet } from "./landing-examples";

type LanguageDay = { name: string; steps: DayListStep[] };

async function getLondonDay(): Promise<LanguageDay> {
  const t = await getExtracted();

  return {
    name: t({ description: "Use your language's name for London.", message: "English for London" }),
    steps: toExampleSteps([
      {
        detail: t("Conversation"),
        kind: "conversation",
        minutes: 10,
        title: t({
          description: "A topic for learning English before moving to London.",
          message: "Renting a flat",
        }),
      },
      { detail: t("Grammar"), kind: "lesson", minutes: 8, title: t("Present perfect") },
      { detail: t("Quick review"), kind: "review", minutes: 4, title: t("Phrasal verbs") },
      {
        detail: t("Pronunciation"),
        kind: "lesson",
        minutes: 8,
        title: t({
          description: "A pronunciation topic for learners of English.",
          message: "Pronouncing “th”",
        }),
      },
    ]),
  };
}

async function getMexicoCityDay(): Promise<LanguageDay> {
  const t = await getExtracted();

  return {
    name: t({
      description: "An example goal's name. Use your language's name for Mexico City.",
      message: "Spanish for Mexico City",
    }),
    steps: toExampleSteps([
      {
        detail: t("Conversation"),
        kind: "conversation",
        minutes: 10,
        title: t({
          description: "A topic for learning Spanish before moving to Mexico City.",
          message: "Renting an apartment",
        }),
      },
      {
        detail: t("Grammar"),
        kind: "lesson",
        minutes: 8,
        title: t({
          description: "A Spanish grammar topic: keep “ser” and “estar” in Spanish.",
          message: "Ser and estar",
        }),
      },
      {
        detail: t("Quick review"),
        kind: "review",
        minutes: 4,
        title: t({ description: "A Spanish grammar topic.", message: "The preterite" }),
      },
      {
        detail: t("Pronunciation"),
        kind: "lesson",
        minutes: 8,
        title: t({
          description: "A pronunciation topic for learners of Spanish.",
          message: "Rolling the “rr”",
        }),
      },
    ]),
  };
}

export async function getLanguageDay(): Promise<LanguageDay> {
  const { move } = await getExampleSet();
  return move === "mexico-city" ? getMexicoCityDay() : getLondonDay();
}
