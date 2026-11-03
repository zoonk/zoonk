import { type LessonScreen, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { temperatureSpec, writtenTemperatureLesson } from "./_test-utils/written-lessons";
import { checkWrittenLesson } from "./lesson-code-checks";

const TABLE = "| Time | Temperature |\n| --- | ---: |\n| 7 am | −3 °C |\n| Noon | 2 °C |";

function withScreens(changes: Record<number, WrittenScreen>): WrittenLesson {
  const lesson = writtenTemperatureLesson();

  return { ...lesson, screens: lesson.screens.map((screen, index) => changes[index] ?? screen) };
}

function planned(changes: Record<number, Partial<LessonScreen>>): LessonSpec {
  const spec = temperatureSpec();

  return {
    ...spec,
    screens: spec.screens.map((screen, index) => ({ ...screen, ...changes[index] })),
  };
}

function flowCodes(
  lesson: WrittenLesson,
  spec: LessonSpec = temperatureSpec(),
  options: Partial<Parameters<typeof checkWrittenLesson>[0]> = {},
) {
  const flow = new Set([
    "basis",
    "guessAnswer",
    "moneyFormat",
    "newTerms",
    "plannedVisual",
    "repeatedVisual",
    "screenWords",
  ]);

  return checkWrittenLesson({ language: "en", lesson, level: "beginner", spec, ...options })
    .problems.filter((problem) => flow.has(problem.code))
    .map((problem) => [problem.screen, problem.code]);
}

function words(count: number): string {
  return Array.from({ length: count }, () => "word").join(" ");
}

function explanation(text: string): Extract<WrittenScreen, { kind: "explanation" }> {
  return {
    exampleLineIdea: null,
    explore: null,
    image: null,
    kind: "explanation",
    text,
    title: "An idea",
    visual: null,
  };
}

function guess(question: string, options: [string, ...string[]]): WrittenScreen {
  return {
    image: null,
    kind: "hookGuess",
    options: options.map((text, index) => ({ isCorrect: index === 0, text })),
    question,
    reveal: "The next screen shows why.",
    visual: null,
  };
}

const guessAfterWorkedExample = planned({ 3: { kind: "guess" } });

describe("checkWrittenLesson's flow checks", () => {
  it("passes the lesson as written", () => {
    expect(flowCodes(writtenTemperatureLesson())).toStrictEqual([]);
  });

  it("flags a guess whose question holds its answer or asks for the last screen's result", () => {
    const holds = guess("Does the mark keep going up past zero?", [
      "Keep going up past zero",
      "It stops at zero",
    ]);

    const repeats = guess("And now, what does the thermometer show?", ["2 °C", "8 °C", "−8 °C"]);

    const hunch = guess("It's −1 °C and it warms 4 degrees. Is the mark above or below zero?", [
      "Above zero",
      "Below zero",
      "Exactly at zero",
    ]);

    expect(flowCodes(withScreens({ 3: holds }), guessAfterWorkedExample)).toStrictEqual([
      [3, "guessAnswer"],
    ]);

    expect(flowCodes(withScreens({ 3: repeats }), guessAfterWorkedExample)).toStrictEqual([
      [3, "guessAnswer"],
    ]);

    expect(flowCodes(withScreens({ 3: hunch }), guessAfterWorkedExample)).toStrictEqual([]);
  });

  it("asks every check but the application for a sentence that's really on an earlier screen", () => {
    const lesson = writtenTemperatureLesson();
    const [check, application] = [lesson.screens[6], lesson.screens[7]];

    if (check?.kind !== "check" || application?.kind !== "check") {
      throw new Error("Screens 7 and 8 are checks.");
    }

    const misquote = { quote: "Zero never stops a rise.", screen: 3 };

    expect(flowCodes(withScreens({ 6: { ...check, basis: null } }))).toStrictEqual([[6, "basis"]]);

    expect(flowCodes(withScreens({ 6: { ...check, basis: misquote } }))).toStrictEqual([
      [6, "basis"],
    ]);

    expect(flowCodes(withScreens({ 7: { ...application, basis: misquote } }))).toStrictEqual([]);
  });

  it("flags a screen that explains two new terms in bold, not one that recalls an earlier one", () => {
    const two = explanation("**Zero** is just a **reference point** on the way up.");
    const recalled = explanation("Moving **up** past **zero** is still a rise.");

    expect(flowCodes(withScreens({ 4: two }))).toStrictEqual([[4, "newTerms"]]);
    expect(flowCodes(withScreens({ 4: recalled }))).toStrictEqual([]);
  });

  it("flags money written two ways, but not cents an amount really has", () => {
    const withCents = explanation("A coat costs R$ 2.000,00 in winter.");
    const without = explanation("Gloves cost R$ 500 in winter.");
    const realCents = explanation("A coffee costs R$ 2,50 on cold days.");

    expect(flowCodes(withScreens({ 1: { ...withCents, image: null }, 4: without }))).toContainEqual(
      [4, "moneyFormat"],
    );

    expect(flowCodes(withScreens({ 4: without, 6: realCents }))).not.toContainEqual([
      6,
      "moneyFormat",
    ]);
  });

  it("compares how money is written within one currency, never across two", () => {
    const dollars = explanation("A coat costs US$ 200 in winter.");
    const sameDollars = explanation("Gloves cost $ 50 in winter.");
    const reais = explanation("In São Paulo the coat costs R$ 1.000,00.");
    const euros = explanation("In Lisbon it costs € 180.");

    expect(flowCodes(withScreens({ 1: dollars, 4: sameDollars }))).toContainEqual([
      4,
      "moneyFormat",
    ]);

    expect(flowCodes(withScreens({ 1: reais, 4: euros }))).not.toContainEqual([4, "moneyFormat"]);
  });

  it("flags an explanation far over its word target, a lower one for new learners", () => {
    const sixty = explanation(`${words(59)}.`);
    const eighty = explanation(`${words(79)}.`);
    const withTable = explanation(`${words(40)}.\n\n${TABLE}`);

    expect(flowCodes(withScreens({ 4: sixty }))).toStrictEqual([[4, "screenWords"]]);

    expect(
      flowCodes(withScreens({ 4: sixty }), temperatureSpec(), { level: "advanced" }),
    ).toStrictEqual([]);

    expect(
      flowCodes(withScreens({ 4: sixty }), temperatureSpec(), {
        exams: [{ name: "SAT", style: "multipleChoice" }],
      }),
    ).toStrictEqual([]);

    expect(
      flowCodes(withScreens({ 4: eighty }), temperatureSpec(), { level: "advanced" }),
    ).toStrictEqual([[4, "screenWords"]]);

    expect(flowCodes(withScreens({ 4: withTable }))).toStrictEqual([]);
  });

  it("asks for the visual the plan names and never the same table twice in a row", () => {
    const tableSpec = planned({ 4: { visualKind: "table" } });
    const chartSpec = planned({ 4: { visualKind: "chart" } });

    const chart: WrittenScreen = {
      ...explanation("Look how the line climbs past zero."),
      visual: {
        axisStart: null,
        categories: ["7 am", "Noon"],
        categoryLabel: "Time",
        chart: "line",
        kind: "chart",
        series: [{ name: "Temperature", values: [-3, 2] }],
        source: null,
        title: "A morning warming up",
        unit: "°C",
        valueLabel: "Temperature",
      },
    };

    const tabled = withScreens({ 4: explanation(`Look:\n\n${TABLE}`) });
    const calculation = writtenTemperatureLesson().screens[3];

    if (calculation?.kind !== "mathCheck") {
      throw new Error("Screen 4 is a math check.");
    }

    expect(flowCodes(writtenTemperatureLesson(), tableSpec)).toStrictEqual([[4, "plannedVisual"]]);
    expect(flowCodes(tabled, tableSpec)).toStrictEqual([]);
    expect(flowCodes(withScreens({ 4: chart }), chartSpec)).toStrictEqual([]);

    const templateSpec = planned({
      4: { activityTemplate: "processOrder", visualKind: "template" },
    });

    const brokenExplore = {
      ...explanation("Follow the steps."),
      explore: { content: JSON.stringify({ fields: { steps: [] } }), template: "processOrder" },
    };

    const missing = checkWrittenLesson({
      language: "en",
      lesson: withScreens({ 4: brokenExplore }),
      level: "beginner",
      spec: templateSpec,
    }).problems.find((problem) => problem.code === "plannedVisual");

    expect(missing?.problem).toContain("fields.steps");

    const repeated = withScreens({
      3: { ...calculation, context: TABLE },
      4: explanation(`Look again:\n\n${TABLE}`),
    });

    expect(flowCodes(repeated)).toContainEqual([4, "repeatedVisual"]);
  });

  it("flags the same template on two screens in a row, an explore then its activity included", () => {
    const activity = writtenTemperatureLesson().screens[5];

    if (activity?.kind !== "activity") {
      throw new Error("Screen 6 is an activity.");
    }

    const { fields } = JSON.parse(activity.content) as { fields: unknown };
    const explore = { content: JSON.stringify({ fields }), template: "numberLine" };
    const exploreSpec = planned({ 4: { activityTemplate: "numberLine", visualKind: "template" } });

    expect(
      flowCodes(
        withScreens({ 4: { ...explanation("Move the dot up from −3 °C."), explore } }),
        exploreSpec,
      ),
    ).toStrictEqual([[5, "repeatedVisual"]]);

    expect(flowCodes(writtenTemperatureLesson())).toStrictEqual([]);
  });
});
