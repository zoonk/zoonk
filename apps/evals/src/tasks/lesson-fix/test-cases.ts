import { type OptionalCountry, type TestCase } from "@/lib/types";
import { type FixLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer/fix";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { describeActivityTemplates } from "@zoonk/core/library/activities/writer-templates";
import { BASE_LESSONS } from "../lesson-quality-check/base-lessons";
import realLessons from "./real-lessons.json";
import { RECORDED_SCIENTIFIC_NOTATION_FIX } from "./scientific-notation-case";

type BaseLesson = (typeof BASE_LESSONS)[keyof typeof BASE_LESSONS];

type LessonFixInput = Omit<
  OptionalCountry<FixLessonDraftParams>,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

export type LessonFixExpected = { screens: number[]; real?: "citation" | "term" };

function withScreens(base: BaseLesson, replacements: Record<number, WrittenScreen>): WrittenLesson {
  const lesson = structuredClone(base.lesson) as WrittenLesson;

  return {
    ...lesson,
    screens: lesson.screens.map((screen, index) => replacements[index] ?? screen),
  };
}

function toInput(
  base: BaseLesson,
  lesson: WrittenLesson,
  problems: FixLessonDraftParams["problems"],
): LessonFixInput {
  return {
    ...base,
    activityTemplates: describeActivityTemplates(
      base.spec.screens.flatMap((screen) => screen.activityTemplate ?? []),
    ),
    lesson,
    problems,
  };
}

const { temperature } = BASE_LESSONS;
const temperatureScreens = (temperature.lesson as WrittenLesson).screens;
const mathCheck = temperatureScreens[4] as Extract<WrittenScreen, { kind: "mathCheck" }>;

const REAL_CASES: TestCase<LessonFixExpected, LessonFixInput>[] = realLessons.map(
  (recorded, index) => ({
    expected: { real: index === 0 ? "citation" : "term", screens: index === 0 ? [] : [13, 15] },
    id: index === 0 ? "real-citation" : "real-term",
    language: "pt",
    origin: "production",
    userInput: {
      ...recorded.context,
      lesson: recorded.lesson,
      problems: [
        {
          problem:
            index === 0
              ? "The citation should be art. 4º, § 1º, as the plan says."
              : "Only impeachment ends a presidential term early is false: resignation, death and conviction for a common crime also do.",
          screen: index === 0 ? 3 : 13,
          source: "review",
        },
      ],
    } as LessonFixInput,
  }),
);

export const TEST_CASES: TestCase<LessonFixExpected, LessonFixInput>[] = [
  ...REAL_CASES,
  {
    expected: { screens: [1, 4] },
    id: "en-temperature-code-problems",
    userInput: toInput(
      temperature,
      withScreens(temperature, {
        1: {
          exampleLineIdea: null,
          explore: null,
          image: {
            alt: "A thermometer with an arrow going up past zero.",
            prompt: "A thermometer from −5 °C to 5 °C.",
          },
          kind: "explanation",
          text: "It's important to note that a rise always moves **up** the thermometer. From −3 °C, going up 3 degrees takes you to zero.",
          title: "Up is up, even below zero",
          visual: null,
        },
        4: {
          ...mathCheck,
          math: {
            ...mathCheck.math,
            steps: [
              { expression: null, text: "Start at {start} °C and move {rise} degrees up." },
              { expression: null, text: "You land on {result} °C." },
            ],
          },
        },
      }),
      [
        {
          problem: 'Uses filler ("it\'s important to note"); cut it and say the idea directly.',
          screen: 1,
          source: "check" as const,
        },
        {
          problem: "Step 2 shows {result} without an expression.",
          screen: 4,
          source: "check" as const,
        },
      ],
    ),
  },
  {
    expected: { screens: [1, 4] },
    id: "en-temperature-basis-follows",
    userInput: toInput(
      temperature,
      withScreens(temperature, {
        1: {
          exampleLineIdea: null,
          explore: null,
          image: {
            alt: "A thermometer with an arrow going up past zero.",
            prompt: "A thermometer from −5 °C to 5 °C.",
          },
          kind: "explanation",
          text: "It's important to note that a rise always moves **up** the thermometer. From −3 °C, going up 3 degrees takes you to zero.",
          title: "Up is up, even below zero",
          visual: null,
        },
        4: {
          ...mathCheck,
          basis: { quote: "a rise always moves **up** the thermometer.", screen: 2 },
          math: {
            ...mathCheck.math,
            steps: [
              { expression: null, text: "Start at {start} °C and move {rise} degrees up." },
              { expression: null, text: "You land on {result} °C." },
            ],
          },
        },
      }),
      [
        {
          problem: 'Uses filler ("it\'s important to note"); cut it and say the idea directly.',
          screen: 1,
          source: "check" as const,
        },
        {
          problem: "Step 2 shows {result} without an expression.",
          screen: 4,
          source: "check" as const,
        },
      ],
    ),
  },
  {
    expected: { screens: [6] },
    id: "en-temperature-activity-answer",
    userInput: toInput(
      temperature,
      withScreens(temperature, {
        6: {
          content: JSON.stringify({
            check: {
              answer: 6,
              explanation: "−3 + 8 = 6, so it's 6 °C at noon.",
              kind: "numeric",
              question: "What's the temperature at noon?",
              tolerance: { kind: "absolute", value: 0.01 },
              unit: "°C",
            },
            fields: {
              label: "Temperature",
              max: 7,
              min: -5,
              moves: [{ by: 3 }, { by: 5 }],
              start: -3,
              step: 1,
              unit: "°C",
            },
            prompt: "At 7 am it's −3 °C. By noon it's 8 degrees warmer. Move the dot.",
          }),
          kind: "activity",
          template: "numberLine",
        },
      }),
      [
        {
          problem: "check.answer: The answer 6 doesn't match the computed 5",
          screen: 6,
          source: "check" as const,
        },
      ],
    ),
  },
  {
    expected: { screens: [9] },
    id: "en-scientific-notation-keeps-math",
    userInput: RECORDED_SCIENTIFIC_NOTATION_FIX,
  },
];
