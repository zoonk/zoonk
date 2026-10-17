import { getExtracted } from "next-intl/server";
import { getExamTomorrow } from "./exam-tomorrow";
import { type ExampleGoal } from "./landing-examples";
import { type Tomorrow, getStepDetails } from "./tomorrow-steps";

/** The job goal's tomorrow, both ways. */
async function getJobTomorrow(): Promise<Tomorrow> {
  const t = await getExtracted();
  const { mistakes, yesterday } = await getStepDetails();

  return {
    missed: [
      {
        detail: yesterday(t("SQL")),
        id: "group-by",
        kind: "lesson",
        minutes: 6,
        note: 1,
        state: "current",
        title: t("GROUP BY with two columns"),
      },
      {
        id: "review",
        kind: "review",
        minutes: 3,
        note: 2,
        state: "ahead",
        title: t("Review: joins"),
      },
      {
        detail: t("SQL"),
        id: "having",
        kind: "lesson",
        minutes: 6,
        note: 3,
        state: "ahead",
        title: t("HAVING: filtering groups"),
      },
      {
        detail: mistakes(2),
        id: "mistakes",
        kind: "mistakes",
        minutes: 3,
        note: 4,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
    ],
    studied: [
      {
        detail: t("SQL"),
        id: "having",
        kind: "lesson",
        minutes: 6,
        note: 1,
        state: "current",
        title: t("HAVING: filtering groups"),
      },
      {
        id: "review",
        kind: "review",
        minutes: 3,
        note: 2,
        state: "ahead",
        title: t("Review: GROUP BY"),
      },
      {
        detail: t("SQL · from real work"),
        id: "problem",
        kind: "practice",
        minutes: 8,
        state: "ahead",
        title: t("Real problem: top customers"),
      },
      {
        detail: mistakes(1),
        id: "mistakes",
        kind: "mistakes",
        minutes: 3,
        note: 3,
        state: "ahead",
        title: t("Practice your mistakes"),
      },
    ],
  };
}

/** The move goal's tomorrow, both ways. */
async function getMoveTomorrow(): Promise<Tomorrow> {
  const t = await getExtracted();
  const { yesterday } = await getStepDetails();

  return {
    missed: [
      {
        detail: yesterday(t("Lesson + 6 questions")),
        id: "apartment",
        kind: "lesson",
        minutes: 12,
        note: 1,
        state: "current",
        title: t("Calling about an apartment"),
      },
      {
        id: "review",
        kind: "review",
        minutes: 5,
        note: 2,
        state: "ahead",
        title: t("Review: airport and metro"),
      },
      {
        detail: t("Lesson + 5 questions"),
        id: "visit",
        kind: "lesson",
        minutes: 10,
        note: 3,
        state: "ahead",
        title: t("Visiting a flat"),
      },
      {
        detail: t("3 to practice"),
        id: "mistakes",
        kind: "mistakes",
        minutes: 3,
        note: 4,
        state: "ahead",
        title: t("Mistakes: getting around the city"),
      },
    ],
    studied: [
      {
        detail: t("Lesson + 5 questions"),
        id: "visit",
        kind: "lesson",
        minutes: 10,
        note: 1,
        state: "current",
        title: t("Visiting a flat"),
      },
      {
        id: "review",
        kind: "review",
        minutes: 5,
        note: 2,
        state: "ahead",
        title: t("Review: calling about an apartment"),
      },
      {
        detail: t("Pronunciation tips"),
        id: "booking",
        kind: "conversation",
        minutes: 8,
        state: "ahead",
        title: t("Speaking: booking a visit"),
      },
      {
        detail: t("2 to practice"),
        id: "mistakes",
        kind: "mistakes",
        minutes: 7,
        note: 3,
        state: "ahead",
        title: t("Mistakes: calling about an apartment"),
      },
    ],
  };
}

/**
 * Each example goal's tomorrow, both ways. Its rows follow the captions' order: studied, the
 * lesson written for the goal (1), a review (2) and the mistakes (3); missed, yesterday's lesson
 * first (1), then a review (2), a lesson (3) and the mistakes (4). Each day fits the goal's time.
 */
export async function getTomorrows(): Promise<Record<ExampleGoal, Tomorrow>> {
  const exam = await getExamTomorrow();
  const job = await getJobTomorrow();
  const move = await getMoveTomorrow();

  return { exam, job, move };
}
