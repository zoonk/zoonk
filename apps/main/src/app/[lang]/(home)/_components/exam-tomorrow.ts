import { getExtracted } from "next-intl/server";
import { getExampleSet } from "./landing-examples";
import { type Tomorrow, getStepDetails } from "./tomorrow-steps";

async function getEnemTomorrow(): Promise<Tomorrow> {
  const t = await getExtracted();
  const { mistakes, yesterday } = await getStepDetails();

  return {
    missed: [
      {
        detail: yesterday(t("Human Sciences")),
        id: "republic",
        kind: "lesson",
        minutes: 3,
        note: 1,
        state: "current",
        title: t("The 1922 Republican Reaction"),
      },
      {
        id: "review",
        kind: "review",
        minutes: 2,
        note: 2,
        state: "ahead",
        title: t("Quick review"),
      },
      {
        detail: t("Mathematics"),
        id: "discounts",
        kind: "lesson",
        minutes: 5,
        note: 3,
        state: "ahead",
        title: t("Coupons and discounts together"),
      },
      {
        detail: mistakes(3),
        id: "mistakes",
        kind: "mistakes",
        minutes: 5,
        note: 4,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
      {
        detail: t("Essay"),
        id: "essay",
        kind: "essay",
        minutes: 10,
        state: "ahead",
        title: t("Agent and action"),
      },
    ],
    studied: [
      {
        detail: t("Natural Sciences"),
        id: "breathing",
        kind: "lesson",
        minutes: 4,
        note: 1,
        state: "current",
        title: t("Breathing and heat loss"),
      },
      {
        detail: t("Human Sciences"),
        id: "review",
        kind: "review",
        minutes: 4,
        note: 2,
        state: "ahead",
        title: t("Review: the Republican Reaction"),
      },
      {
        detail: t("Languages and Codes"),
        id: "text-image",
        kind: "lesson",
        minutes: 5,
        state: "ahead",
        title: t("Verbal text and images"),
      },
      {
        detail: mistakes(2),
        id: "mistakes",
        kind: "mistakes",
        minutes: 4,
        note: 3,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
      {
        detail: t("Essay"),
        id: "essay",
        kind: "essay",
        minutes: 8,
        state: "ahead",
        title: t("Means of carrying it out"),
      },
    ],
  };
}

async function getSatTomorrow(): Promise<Tomorrow> {
  const t = await getExtracted();
  const { mistakes, yesterday } = await getStepDetails();

  return {
    missed: [
      {
        detail: yesterday(t("Reading and Writing")),
        id: "words",
        kind: "lesson",
        minutes: 5,
        note: 1,
        state: "current",
        title: t("Words in context"),
      },
      {
        id: "review",
        kind: "review",
        minutes: 2,
        note: 2,
        state: "ahead",
        title: t("Quick review"),
      },
      {
        detail: t("Math"),
        id: "equations",
        kind: "lesson",
        minutes: 6,
        note: 3,
        state: "ahead",
        title: t("Linear equations in context"),
      },
      {
        detail: mistakes(3),
        id: "mistakes",
        kind: "mistakes",
        minutes: 5,
        note: 4,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
      {
        detail: t("Reading and Writing"),
        id: "transitions",
        kind: "lesson",
        minutes: 7,
        state: "ahead",
        title: t({
          description: "A writing lesson on linking words, such as “however” and “therefore”.",
          message: "Transitions",
        }),
      },
    ],
    studied: [
      {
        detail: t("Reading and Writing"),
        id: "synthesis",
        kind: "lesson",
        minutes: 7,
        note: 1,
        state: "current",
        title: t("Rhetorical synthesis"),
      },
      {
        detail: t("Reading and Writing"),
        id: "review",
        kind: "review",
        minutes: 6,
        note: 2,
        state: "ahead",
        title: t("Review: words in context"),
      },
      {
        detail: t("Math"),
        id: "slope",
        kind: "lesson",
        minutes: 6,
        state: "ahead",
        title: t("Slope and intercept"),
      },
      {
        detail: mistakes(2),
        id: "mistakes",
        kind: "mistakes",
        minutes: 6,
        note: 3,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
    ],
  };
}

export async function getExamTomorrow(): Promise<Tomorrow> {
  const set = await getExampleSet();

  return set.exam === "enem" ? getEnemTomorrow() : getSatTomorrow();
}
