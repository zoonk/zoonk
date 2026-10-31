import { getExtracted, getFormatter } from "next-intl/server";
import { cache } from "react";
import { type HeroExample, toSteps } from "./hero-example";
import { getJobTopics } from "./hero-job-topics";
import { getLondonExample, getMexicoCityExample } from "./hero-move-examples";
import {
  type ExampleGoal,
  getExampleCalendar,
  getExampleSet,
  getGoalDate,
} from "./landing-examples";

async function getExamExample(): Promise<HeroExample> {
  const t = await getExtracted();
  const format = await getFormatter();
  const { exam } = await getExampleSet();
  const calendar = await getExampleCalendar();
  const searched = exam.name.toLocaleLowerCase();

  const date = format.dateTime(getGoalDate({ calendar, goal: "exam" }), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return {
    file: t({
      description:
        "A messy spreadsheet's file name. Translate “schedule” with one short word of at most 9 letters and keep the underscores, “FINAL_v3” and “.xlsx”. {exam} is the exam's name in lowercase. In Brazilian Portuguese: “cronograma_{exam}_FINAL_v3.xlsx”.",
      message: "schedule_{exam}_FINAL_v3.xlsx",
      values: { exam: searched },
    }),
    label: t({
      description: "{exam} is a national exam's short name, such as Enem or SAT.",
      message: "Everything that can come up on the {exam}",
      values: { exam: exam.name },
    }),
    moreTabs: 20,
    name: t("{exam} on {date}", { date, exam: exam.name }),
    search: t({
      description:
        "What a worried student types into a search engine: casual, lowercase, no final punctuation. {exam} is the exam's name in lowercase.",
      message: "where to start studying for the {exam}",
      values: { exam: searched },
    }),
    steps: toSteps(exam.day),
    suggestions: [
      t({
        description:
          "A search engine's suggestion: casual, lowercase, as short as the English. {exam} is lowercase.",
        message: "studying for the {exam} from scratch",
        values: { exam: searched },
      }),
      t({
        description:
          "A search engine's suggestion: casual, lowercase, as short as the English. {exam} is lowercase.",
        message: "what comes up most on the {exam}",
        values: { exam: searched },
      }),
    ],
    tabs: exam.tabs,
    topics: exam.topics,
  };
}

async function getJobExample(): Promise<HeroExample> {
  const t = await getExtracted();
  // Its own namespace: the app's "Statistics" is a page, translated as a plural.
  const tSubject = await getExtracted("examplePhases");
  const format = await getFormatter();
  const calendar = await getExampleCalendar();

  const month = format.dateTime(getGoalDate({ calendar, goal: "job" }), {
    month: "long",
    timeZone: "UTC",
  });

  const day = {
    chart: t("Choosing the right chart"),
    groupBy: t({ description: "An SQL clause; keep it as is.", message: "GROUP BY" }),
    joins: t({ description: "SQL joins; keep “JOIN” as is.", message: "JOINs in SQL" }),
    median: t("Mean and median"),
  };

  return {
    file: t({
      description:
        "A spreadsheet's file name, as short as the English: translate the words and keep the underscores and “.xlsx”. In Brazilian Portuguese: “plano_dados_2027.xlsx”.",
      message: "data_plan_2027.xlsx",
    }),
    label: t("Everything that shows up in data analyst job posts"),
    moreTabs: 23,
    name: t("Data analyst by {month}", { month }),
    search: t({
      description:
        "What someone types into a search engine: casual, lowercase, no final punctuation.",
      message: "what to study to become a data analyst",
    }),
    steps: toSteps([
      { detail: t("SQL"), kind: "lesson", minutes: 7, title: day.joins, topic: day.joins },
      {
        detail: tSubject({
          description: "The subject, as a field of study.",
          message: "Statistics",
        }),
        kind: "review",
        minutes: 4,
        title: day.median,
        topic: day.median,
      },
      {
        detail: t("SQL"),
        kind: "practice",
        minutes: 8,
        title: t("Real problem: sales by region"),
        topic: day.groupBy,
      },
      {
        detail: t("Data visualization"),
        kind: "lesson",
        minutes: 6,
        title: day.chart,
        topic: day.chart,
      },
    ]),
    suggestions: [
      t({
        description: "A search engine's suggestion: casual, lowercase, as short as the English.",
        message: "data analyst without a degree",
      }),
      t({
        description:
          "A search engine's suggestion: casual, lowercase, as short as the English. Keep “sql” and “python”.",
        message: "sql or python first",
      }),
    ],
    tabs: [
      t({
        description:
          "A browser tab's title for a video course, as short as the English: a phone shows it beside another tab.",
        message: "SQL basics",
      }),
      t({
        description:
          "A browser tab's title for a video course, as short as the English: a phone shows it beside another tab.",
        message: "Power BI tutorial",
      }),
    ],
    topics: await getJobTopics(day),
  };
}

export const getHeroExamples = cache(async (): Promise<Record<ExampleGoal, HeroExample>> => {
  const set = await getExampleSet();
  const exam = await getExamExample();
  const move = set.move === "mexico-city" ? await getMexicoCityExample() : await getLondonExample();
  const job = await getJobExample();

  return { exam, job, move };
});
