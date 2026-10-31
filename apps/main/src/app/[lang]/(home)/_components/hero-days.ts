import { type DayListStep } from "@/components/public/day-list";
import { getExtracted } from "next-intl/server";
import { examStep } from "./exam-tomorrow";
import { type ExampleGoal, getExampleSet } from "./landing-examples";

export async function getHeroDays(): Promise<Record<ExampleGoal, DayListStep[]>> {
  const t = await getExtracted();
  const set = await getExampleSet();

  const mistakes = (count: number) =>
    t("{count, plural, one {# mistake} other {# mistakes}}", { count });

  const [first, second, last] = set.exam.today;

  const exam: DayListStep[] = [
    { id: "review", kind: "review", minutes: 2, state: "done", title: t("Quick review") },
    { ...examStep(first), state: "current" },
    { ...examStep(second), state: "ahead" },
    {
      detail: mistakes(3),
      id: "mistakes",
      kind: "mistakes",
      minutes: 5,
      state: "ahead",
      title: t("Practice your mistakes"),
    },
    { ...examStep(last), state: "ahead" },
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
