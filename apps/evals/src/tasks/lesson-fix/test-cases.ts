import { type TestCase } from "@/lib/types";
import { type FixLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describeActivityTemplates } from "@zoonk/core/library/activities/writer-templates";
import { BASE_LESSONS } from "../lesson-quality-check/base-lessons";

type BaseLesson = (typeof BASE_LESSONS)[keyof typeof BASE_LESSONS];

type LessonFixInput = Omit<
  FixLessonDraftParams,
  "analytics" | "model" | "reasoning" | "useFallback"
>;

/** The screens (0-based) the problems name, which the fix must change. */
export type LessonFixExpected = { screens: number[] };

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
    activityTemplates: describeActivityTemplates(
      base.spec.screens.flatMap((screen) => screen.activityTemplate ?? []),
    ),
    chapterTitle: base.chapterTitle,
    courseTitle: base.courseTitle,
    language: base.language,
    lesson,
    level: base.level,
    problems,
    spec: base.spec,
  };
}

const { regra, temperature } = BASE_LESSONS;
const temperatureScreens = (temperature.lesson as WrittenLesson).screens;
const mathCheck = temperatureScreens[3] as Extract<WrittenScreen, { kind: "mathCheck" }>;

export const TEST_CASES: TestCase<LessonFixExpected, LessonFixInput>[] = [
  {
    expected: { screens: [1, 3] },
    id: "en-temperature-code-problems",
    userInput: toInput(
      temperature,
      withScreens(temperature, {
        1: {
          exampleLineIdea: null,
          image: {
            alt: "A thermometer with an arrow going up past zero.",
            prompt: "A thermometer from −5 °C to 5 °C.",
          },
          kind: "explanation",
          text: "It's important to note that a rise always moves **up** the thermometer. From −3 °C, going up 3 degrees takes you to zero.",
          title: "Up is up, even below zero",
        },
        3: {
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
        },
        { problem: "Step 2 shows {result} without an expression.", screen: 3 },
      ],
    ),
  },
  {
    expected: { screens: [5] },
    id: "en-temperature-activity-answer",
    userInput: toInput(
      temperature,
      withScreens(temperature, {
        5: {
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
      [{ problem: "check.answer: The answer 6 doesn't match the computed 5", screen: 5 }],
    ),
  },
  {
    expected: { screens: [2] },
    id: "pt-regra-reviewer-jargon",
    userInput: toInput(
      regra,
      withScreens(regra, {
        2: {
          exampleLineIdea: null,
          image: null,
          kind: "explanation",
          text: "Grandezas inversamente proporcionais têm produto constante: $x \\cdot y = k$, em que $k$ é a constante de proporcionalidade. Já nas diretamente proporcionais, a razão $y/x$ é invariante.",
          title: "O que fica fixo?",
        },
      }),
      [
        {
          problem:
            'Uses "grandezas inversamente proporcionais", "constante de proporcionalidade" and notation before explaining them, right after a check about the gráfica. Fix: build on the gráfica check in everyday words: with the same order, more people means less time (inverse); with the same team, more labels means more time (direct). Introduce one term at a time and no notation.',
          screen: 2,
        },
      ],
    ),
  },
];
