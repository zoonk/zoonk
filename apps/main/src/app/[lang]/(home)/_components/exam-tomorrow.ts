import { getExtracted } from "next-intl/server";
import { type ExamLesson } from "./example-set";
import { getExampleSet } from "./landing-examples";
import { type Tomorrow, getStepDetails } from "./tomorrow-steps";

export function examStep({ essay, id, minutes, subject, title }: ExamLesson) {
  return { detail: subject.name, id, kind: essay ? "essay" : "lesson", minutes, title } as const;
}

export async function getExamTomorrow(): Promise<Tomorrow> {
  const t = await getExtracted();
  const { mistakes, yesterday } = await getStepDetails();
  const { exam } = await getExampleSet();
  const [first, second, last] = exam.today;
  const [next, after, ...rest] = exam.tomorrow.lessons;

  return {
    missed: [
      { ...examStep(first), detail: yesterday(first.subject.name), note: 1, state: "current" },
      {
        id: "review",
        kind: "review",
        minutes: 2,
        note: 2,
        state: "ahead",
        title: t("Quick review"),
      },
      { ...examStep(second), note: 3, state: "ahead" },
      {
        detail: mistakes(3),
        id: "mistakes",
        kind: "mistakes",
        minutes: 5,
        note: 4,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
      { ...examStep(last), state: "ahead" },
    ],
    studied: [
      { ...examStep(next), note: 1, state: "current" },
      { ...examStep(exam.tomorrow.review), kind: "review", note: 2, state: "ahead" },
      { ...examStep(after), state: "ahead" },
      {
        detail: mistakes(2),
        id: "mistakes",
        kind: "mistakes",
        minutes: 4,
        note: 3,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
      ...rest.map((lesson) => ({ ...examStep(lesson), state: "ahead" as const })),
    ],
  };
}
