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
    "screenLength",
  ]);

  return checkWrittenLesson({ language: "en", lesson, level: "beginner", spec, ...options })
    .problems.filter((problem) => flow.has(problem.code))
    .map((problem) => [problem.screen, problem.code]);
}

function lengths(lesson: WrittenLesson) {
  return flowCodes(lesson).filter(([, code]) => code === "screenLength");
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

  it("reads the full-width yen mark Intl writes, so yen written two ways is flagged", () => {
    const fullWidth = explanation("コートは￥2,000です。");
    const halfWidth = explanation("手袋は¥500です。");

    expect(flowCodes(withScreens({ 1: fullWidth, 4: halfWidth }))).toContainEqual([
      4,
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

  it("flags any screen past a tweet's 250 characters at every level, its title included, tables aside", () => {
    const fits = explanation(`${"a".repeat(241)}.`);
    const over = explanation(`${"a".repeat(242)}.`);
    const withTable = explanation(`${"a".repeat(200)}.\n\n${TABLE}`);
    const japanese = explanation(`${"水".repeat(125)}。`);

    expect(flowCodes(withScreens({ 4: fits }))).toStrictEqual([]);
    expect(flowCodes(withScreens({ 4: over }))).toStrictEqual([[4, "screenLength"]]);

    expect(
      flowCodes(withScreens({ 4: over }), temperatureSpec(), { level: "advanced" }),
    ).toStrictEqual([[4, "screenLength"]]);

    expect(flowCodes(withScreens({ 4: withTable }))).toStrictEqual([]);
    expect(flowCodes(withScreens({ 4: japanese }))).toStrictEqual([[4, "screenLength"]]);
  });

  it("measures each option and template text against its own limit, a Japanese character counting twice", () => {
    const { screens } = writtenTemperatureLesson();
    const activity = screens[5];
    const check = screens[6];

    if (activity?.kind !== "activity" || check?.kind !== "check") {
      throw new Error("Screens 6 and 7 are an activity and a check.");
    }

    const withOption = (text: string) => ({
      ...check,
      options: check.options.map((option, index) => (index === 1 ? { ...option, text } : option)),
    });

    const content = JSON.parse(activity.content) as { fields: object };

    const withLabel = (label: string) =>
      JSON.stringify({ ...content, fields: { ...content.fields, label } });

    expect(
      lengths(
        withScreens({
          5: { ...activity, content: withLabel("温度".repeat(10)) },
          6: withOption("a".repeat(130)),
        }),
      ),
    ).toStrictEqual([]);

    expect(
      lengths(
        withScreens({
          5: { ...activity, content: withLabel("温度".repeat(11)) },
          6: withOption("水".repeat(81)),
        }),
      ),
    ).toStrictEqual([
      [5, "screenLength"],
      [6, "screenLength"],
    ]);
  });

  it("counts a worked example's problem, steps and result together, and a check's context with its question", () => {
    const { screens } = writtenTemperatureLesson();
    const worked = screens[2];
    const check = screens[3];

    if (worked?.kind !== "workedExample" || check?.kind !== "mathCheck") {
      throw new Error("Screens 3 and 4 are a worked example and a calculation.");
    }

    const steps = ["a", "b", "c"].map((letter) => ({ math: null, text: letter.repeat(90) }));
    const shortSteps = { ...worked, problem: "p", result: "r", steps: steps.slice(0, 2) };
    const pilingSteps = { ...worked, problem: "p", result: "r", steps };
    const longCheck = { ...check, context: "c".repeat(200), question: "d".repeat(60) };

    expect(lengths(withScreens({ 2: shortSteps }))).toStrictEqual([]);

    expect(lengths(withScreens({ 2: pilingSteps, 3: longCheck }))).toStrictEqual([
      [2, "screenLength"],
      [3, "screenLength"],
    ]);
  });

  it("measures each later moment too: a guess's reveal, each reason and an activity's prompt with its question", () => {
    const { screens } = writtenTemperatureLesson();
    const activity = screens[5];
    const check = screens[6];

    if (activity?.kind !== "activity" || check?.kind !== "check") {
      throw new Error("Screens 6 and 7 are an activity and a check.");
    }

    const revealing = { ...guess("Where does the ice form first?", ["On top", "At the bottom"]) };
    const longReveal = { ...revealing, reveal: "r".repeat(260) };
    const content: unknown = JSON.parse(activity.content);
    const japanesePrompt = JSON.stringify({ ...(content as object), prompt: "水".repeat(130) });

    const longReason = {
      ...check,
      options: check.options.map((option, index) =>
        index === 0 ? { ...option, reason: "w".repeat(260) } : option,
      ),
    };

    const flagged = lengths(
      withScreens({ 1: longReveal, 5: { ...activity, content: japanesePrompt }, 6: longReason }),
    ).map(([screen]) => screen);

    expect(new Set(flagged)).toStrictEqual(new Set([1, 5, 6]));
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

  it("asks for the planned table when the screen's table has no data rows", () => {
    const empty = withScreens({
      4: explanation(
        "By noon the mark has climbed past zero.\n\n| Before | After |\n| ---: | ---: |",
      ),
    });

    expect(flowCodes(empty, planned({ 4: { visualKind: "table" } }))).toStrictEqual([
      [4, "plannedVisual"],
    ]);
  });

  it("takes a one-row table comparing before and after as the planned table", () => {
    const comparison = withScreens({
      4: explanation(
        "By noon the mark has climbed past zero.\n\n| Before | After |\n| ---: | ---: |\n| −3 °C | 2 °C |",
      ),
    });

    expect(flowCodes(comparison, planned({ 4: { visualKind: "table" } }))).toStrictEqual([]);
  });

  it("flags tables with the same columns on two teaching screens in a row, not on a check after them", () => {
    const lesson = writtenTemperatureLesson();
    const [rise, worked, calculation] = [lesson.screens[1], lesson.screens[2], lesson.screens[3]];

    if (
      rise?.kind !== "explanation" ||
      worked?.kind !== "workedExample" ||
      calculation?.kind !== "mathCheck"
    ) {
      throw new Error("Screens 2 to 4 are an explanation, a worked example and a math check.");
    }

    const otherRows = "| Time | Temperature |\n| --- | ---: |\n| 9 am | −1 °C |\n| 3 pm | 4 °C |";
    const tabled = { ...rise, text: `${rise.text}\n\n${TABLE}` };

    expect(
      flowCodes(
        withScreens({ 1: tabled, 2: { ...worked, problem: `${worked.problem}\n\n${otherRows}` } }),
      ),
    ).toContainEqual([2, "repeatedVisual"]);

    expect(
      flowCodes(
        withScreens({
          2: { ...worked, problem: `${worked.problem}\n\n${TABLE}` },
          3: { ...calculation, context: otherRows },
        }),
      ),
    ).not.toContainEqual([3, "repeatedVisual"]);
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
