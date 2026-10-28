import { type DayListStep } from "@/components/public/day-list";
import { getExtracted } from "next-intl/server";
import { type ExampleGoal, getExampleSet } from "./landing-examples";

export async function getHeroDays(): Promise<Record<ExampleGoal, DayListStep[]>> {
  const t = await getExtracted();
  const set = await getExampleSet();

  const mistakes = (count: number) =>
    t("{count, plural, one {# mistake} other {# mistakes}}", { count });

  const exam: DayListStep[] =
    set.exam === "enem"
      ? [
          { id: "review", kind: "review", minutes: 2, state: "done", title: t("Quick review") },
          {
            detail: t("Human Sciences"),
            id: "republic",
            kind: "lesson",
            minutes: 3,
            state: "current",
            title: t("The 1922 Republican Reaction"),
          },
          {
            detail: t("Mathematics"),
            id: "discounts",
            kind: "lesson",
            minutes: 5,
            state: "ahead",
            title: t("Coupons and discounts together"),
          },
          {
            detail: mistakes(3),
            id: "mistakes",
            kind: "mistakes",
            minutes: 5,
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
        ]
      : [
          { id: "review", kind: "review", minutes: 2, state: "done", title: t("Quick review") },
          {
            detail: t("Reading and Writing"),
            id: "words",
            kind: "lesson",
            minutes: 5,
            state: "current",
            title: t("Words in context"),
          },
          {
            detail: t("Math"),
            id: "equations",
            kind: "lesson",
            minutes: 6,
            state: "ahead",
            title: t("Linear equations in context"),
          },
          {
            detail: mistakes(3),
            id: "mistakes",
            kind: "mistakes",
            minutes: 5,
            state: "ahead",
            title: t("Practice your mistakes"),
          },
          {
            detail: t("Reading and Writing"),
            id: "transitions",
            kind: "lesson",
            minutes: 7,
            state: "ahead",
            title: t("Transitions"),
          },
        ];

  return {
    exam,
    job: [
      { id: "review", kind: "review", minutes: 3, state: "done", title: t("Review: joins") },
      {
        detail: t("SQL"),
        id: "group-by",
        kind: "lesson",
        minutes: 6,
        state: "current",
        title: t("GROUP BY with two columns"),
      },
      {
        detail: t("SQL · from real work"),
        id: "problem",
        kind: "practice",
        minutes: 8,
        state: "ahead",
        title: t("Real problem: sales by region"),
      },
      {
        detail: mistakes(2),
        id: "mistakes",
        kind: "mistakes",
        minutes: 3,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
    ],
    move: [
      {
        id: "review",
        kind: "review",
        minutes: 5,
        state: "done",
        title: t("Review: airport and metro"),
      },
      {
        detail: t("Lesson + 6 questions"),
        id: "apartment",
        kind: "lesson",
        minutes: 12,
        state: "current",
        title: t("Calling about an apartment"),
      },
      {
        detail: t("Pronunciation tips"),
        id: "small-talk",
        kind: "conversation",
        minutes: 8,
        state: "ahead",
        title: t("Speaking: asking about the rent"),
      },
      {
        detail: t("3 to practice"),
        id: "mistakes",
        kind: "mistakes",
        minutes: 5,
        state: "ahead",
        title: t("Mistakes: getting around the city"),
      },
    ],
  };
}
