import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { temperatureSpec, writtenTemperatureLesson } from "./_test-utils/written-lessons";
import { checkScreenText, checkWrittenLesson } from "./lesson-code-checks";

function check(lesson: WrittenLesson, options: { allowActivityFallback?: boolean } = {}) {
  return checkWrittenLesson({
    ...options,
    language: "en",
    lesson,
    level: "beginner",
    spec: temperatureSpec(),
  });
}

function withScreen(index: number, screen: WrittenScreen): WrittenLesson {
  const lesson = writtenTemperatureLesson();

  return {
    ...lesson,
    screens: lesson.screens.map((current, at) => (at === index ? screen : current)),
  };
}

function explanation(text: string): Extract<WrittenScreen, { kind: "explanation" }> {
  return {
    exampleLineIdea: null,
    image: null,
    kind: "explanation",
    text,
    title: "An idea",
    visual: null,
  };
}

function codesOf(lesson: WrittenLesson, options: { allowActivityFallback?: boolean } = {}) {
  return check(lesson, options).problems.map((problem) => [problem.screen, problem.code]);
}

describe(checkWrittenLesson, () => {
  it("keeps every picture the plan asks for, on screens in a row too", () => {
    const lesson = writtenTemperatureLesson();
    const picture = { alt: "A thermometer.", prompt: "A thermometer from −5 °C to 5 °C." };
    const spec = temperatureSpec();

    const planned = {
      ...spec,
      screens: spec.screens.map((screen, index) =>
        index === 2 ? { ...screen, visual: "The thermometer again." } : screen,
      ),
    };

    const checked = checkWrittenLesson({
      language: "en",
      lesson: {
        ...lesson,
        screens: lesson.screens.map((screen, index) =>
          index === 2 && screen.kind === "workedExample" ? { ...screen, image: picture } : screen,
        ),
      },
      level: "beginner",
      spec: planned,
    });

    expect(checked.screens[1]?.ok && checked.screens[1].content).toHaveProperty("image");
    expect(checked.screens[2]?.ok && checked.screens[2].content).toMatchObject({ image: picture });
  });

  it("shows the picture, table or chart a screen points at, even where the plan drew none", () => {
    const application = writtenTemperatureLesson().screens[7];

    if (application?.kind !== "check") {
      throw new Error("Screen 8 is a check.");
    }

    const picture = { alt: "A street thermometer at −6 °C.", prompt: "A street thermometer." };

    const pointing = {
      ...application,
      context: "In the picture, a street thermometer shows −6 °C.",
    };

    expect(codesOf(withScreen(7, pointing))).toStrictEqual([[7, "visual"]]);

    const shown = check(withScreen(7, { ...pointing, image: picture }));

    expect(shown.problems).toStrictEqual([]);
    expect(shown.screens[7]?.ok && shown.screens[7].content).toMatchObject({ image: picture });

    const table = explanation(
      "The table below shows the morning.\n\n| Hour | °C |\n|---|---:|\n| 6 am | −6 |",
    );

    expect(codesOf(withScreen(4, table))).toStrictEqual([]);

    expect(codesOf(withScreen(4, explanation("The chart below shows the morning.")))).toStrictEqual(
      [[4, "visual"]],
    );
  });

  it("draws the picture a teaching screen points at, even a diagram the plan didn't ask for", () => {
    const diagram = explanation(
      "In the diagram, the arrow climbs from −3 °C to zero, then two more degrees.",
    );

    const picture = {
      alt: "A thermometer with an arrow from −3 °C up to 2 °C.",
      prompt: "A thermometer from −5 °C to 5 °C with an arrow from −3 °C up to 2 °C.",
    };

    expect(codesOf(withScreen(4, diagram))).toStrictEqual([[4, "visual"]]);

    const shown = check(withScreen(4, { ...diagram, image: picture }));

    expect(shown.problems).toStrictEqual([]);
    expect(shown.screens[4]?.ok && shown.screens[4].content).toMatchObject({ image: picture });

    const versions = explanation(
      "Version 1 counts from −3 °C straight to 2 °C; version 2 stops at zero first.",
    );

    const compared = check(withScreen(4, { ...versions, image: picture }));

    expect(compared.problems).toStrictEqual([]);

    expect(compared.screens[4]?.ok && compared.screens[4].content).toMatchObject({
      image: picture,
    });
  });

  it("keeps the personal example slot of every explanation whose writer left one", () => {
    const second = {
      ...explanation("Zero is just a mark on the way up. Count the degrees to zero, then past it."),
      exampleLineIdea: "Another cold morning.",
    };

    const result = check(withScreen(4, second));

    expect(result.problems).toStrictEqual([]);

    expect(
      result.screens.map((screen) => screen.ok && "exampleLineSlot" in screen.content),
    ).toStrictEqual([false, true, false, false, true, false, false, false]);
  });

  it("passes a lesson that follows its plan and converts every screen", () => {
    const result = check(writtenTemperatureLesson());

    expect(result.problems).toStrictEqual([]);

    expect(result.screens.map((screen) => screen.ok && screen.kind)).toStrictEqual([
      "hook",
      "explanation",
      "workedExample",
      "check",
      "explanation",
      "activity",
      "typedAnswer",
      "check",
    ]);
  });

  it("requires one screen per planned screen", () => {
    const lesson = writtenTemperatureLesson();

    expect(codesOf({ ...lesson, screens: lesson.screens.slice(0, -1) })).toContainEqual([
      null,
      "screenCount",
    ]);
  });

  it("rejects kinds the plan doesn't allow and activities on other templates", () => {
    expect(
      codesOf(withScreen(1, { image: null, kind: "hookText", text: "A fact.", visual: null })),
    ).toContainEqual([1, "screenKind"]);

    const activity = writtenTemperatureLesson().screens[5];

    expect(activity?.kind).toBe("activity");

    expect(
      codesOf(withScreen(5, { ...activity, template: "categorize" } as WrittenScreen)),
    ).toContainEqual([5, "activityTemplate"]);
  });

  it("lets an activity become a check only after the fix pass", () => {
    const application = writtenTemperatureLesson().screens[7];

    if (application?.kind !== "check") {
      throw new Error("Screen 8 is a check.");
    }

    const fallback = { ...application, question: "Where does the dot stop after the rise?" };

    expect(codesOf(withScreen(5, fallback))).toContainEqual([5, "screenKind"]);
    expect(codesOf(withScreen(5, fallback), { allowActivityFallback: true })).toStrictEqual([]);
  });

  it("reports content that breaks the step contract or the activity rules", () => {
    const twoCorrect: WrittenScreen = {
      context: null,
      image: null,
      kind: "check",
      options: [
        { isCorrect: true, reason: "Right.", text: "2 °C" },
        { isCorrect: true, reason: "Also right?", text: "3 °C" },
      ],
      question: "Which one?",
      visual: null,
    };

    const wrongActivityAnswer = {
      content: JSON.stringify({
        check: {
          answer: 6,
          explanation: "Why.",
          kind: "numeric",
          question: "Where?",
          tolerance: { kind: "absolute", value: 0 },
        },
        fields: {
          label: "Temperature",
          max: 7,
          min: -5,
          moves: [{ by: 3 }, { by: 5 }],
          start: -3,
          step: 1,
        },
        prompt: "Move the dot.",
      }),
      kind: "activity",
      template: "numberLine",
    } as const;

    expect(codesOf(withScreen(3, twoCorrect))).toContainEqual([3, "invalidContent"]);
    expect(codesOf(withScreen(5, wrongActivityAnswer))).toContainEqual([5, "invalidContent"]);

    expect(
      codesOf(withScreen(5, { content: "{ not json", kind: "activity", template: "numberLine" })),
    ).toContainEqual([5, "invalidContent"]);
  });

  it("recomputes calculations written as data", () => {
    const mathCheck = writtenTemperatureLesson().screens[3];

    if (mathCheck?.kind !== "mathCheck") {
      throw new Error("Screen 4 is a calculation.");
    }

    const wrongAnswer = { ...mathCheck, math: { ...mathCheck.math, answer: 11 } };

    expect(check(withScreen(3, wrongAnswer)).problems).toContainEqual({
      code: "invalidContent",
      problem: "The stated answer 11 doesn't match the computed 3.",
      screen: 3,
    });
  });

  it("finds framing, filler, long sentences, long screens and wrong arithmetic", () => {
    const longSentence = `The temperature ${"keeps going up and up ".repeat(8)}until it passes zero.`;

    expect(
      codesOf(withScreen(1, explanation("In this lesson you'll learn how rises work."))),
    ).toContainEqual([1, "lessonFraming"]);

    expect(
      codesOf(withScreen(1, explanation("It's important to note that a rise goes up."))),
    ).toContainEqual([1, "filler"]);

    expect(codesOf(withScreen(1, explanation(longSentence)))).toContainEqual([1, "readingLevel"]);

    expect(codesOf(withScreen(1, explanation("A rise goes up. ".repeat(50))))).toContainEqual([
      1,
      "screenLength",
    ]);

    expect(
      codesOf(withScreen(1, explanation("From −3 °C: 3 + 5 = 9, so it's warmer."))),
    ).toContainEqual([1, "arithmetic"]);
  });

  it("rejects options a learner can't tell apart", () => {
    const hook = writtenTemperatureLesson().screens[0];

    if (hook?.kind !== "hookGuess") {
      throw new Error("Screen 1 is a guess.");
    }

    const duplicated = { ...hook, options: [...hook.options, { isCorrect: false, text: "2 °c" }] };

    expect(codesOf(withScreen(0, duplicated))).toContainEqual([0, "duplicateOptions"]);
  });

  it("rejects a guess's reveal that points at an option by its place", () => {
    const hook = writtenTemperatureLesson().screens[0];

    if (hook?.kind !== "hookGuess") {
      throw new Error("Screen 1 is a guess.");
    }

    const byPlace = { ...hook, reveal: "The right answer is the second." };

    expect(codesOf(withScreen(0, byPlace))).toStrictEqual([[0, "optionPosition"]]);
  });

  it("rejects a check that asks an earlier check's question with other numbers", () => {
    const application = writtenTemperatureLesson().screens[7];

    if (application?.kind !== "check") {
      throw new Error("Screen 8 is a check.");
    }

    const repeated = {
      ...application,
      context: null,
      question:
        "At 6 am it was −8 °C. By noon it warmed up 11 degrees. What's the temperature now?",
    };

    expect(codesOf(withScreen(7, repeated))).toStrictEqual([[7, "repeatedQuestion"]]);
  });

  it("keeps the summary card to one distinct sentence per idea", () => {
    const lesson = writtenTemperatureLesson();

    expect(
      codesOf({ ...lesson, summary: ["A rise moves up.", "A rise moves up."] }),
    ).toContainEqual([null, "summary"]);

    expect(codesOf({ ...lesson, summary: ["One. Two. Three."] })).toContainEqual([null, "summary"]);
    expect(codesOf({ ...lesson, summary: [] })).toContainEqual([null, "summary"]);
  });
});

describe(checkScreenText, () => {
  it("checks one screen on its own in the lesson's language", () => {
    expect(
      checkScreenText({
        language: "pt",
        level: "beginner",
        screen: explanation("Nesta lição, 2 + 2 = 5."),
      }),
    ).toHaveLength(2);

    expect(
      checkScreenText({ language: "pt", level: "beginner", screen: explanation("Suba 2 graus.") }),
    ).toStrictEqual([]);
  });
});
