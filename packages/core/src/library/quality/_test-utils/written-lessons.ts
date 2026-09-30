import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";

/** A beginner lesson plan with every screen kind the writer can produce, including an activity. */
export function temperatureSpec(): LessonSpec {
  return {
    canDo: "Work out a temperature after it rises across zero",
    description: "Add a rise to a temperature below zero, the way thermometers do.",
    estimatedMinutes: 4,
    screens: [
      {
        activityTemplate: null,
        brief: "Guess the temperature after a rise.",
        kind: "hook",
        skills: [],
        visual: null,
      },
      {
        activityTemplate: null,
        brief: "A rise moves up the thermometer, even below zero.",
        kind: "explanation",
        skills: [0],
        visual: "A thermometer from −5 °C to 5 °C with an arrow going up.",
      },
      {
        activityTemplate: null,
        brief: "From −3 °C, rise 5 degrees.",
        kind: "workedExample",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief: "Calculate a rise from −4 °C.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief: "Zero is just a mark on the way up.",
        kind: "explanation",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: "numberLine",
        brief: "Move the dot from −3 °C.",
        kind: "activity",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief: "Explain why −3 + 5 is 2.",
        kind: "check",
        skills: [0],
        visual: null,
      },
      {
        activityTemplate: null,
        brief: "A winter morning in Chicago.",
        kind: "application",
        skills: [0],
        visual: null,
      },
    ],
    skills: [
      {
        description: "A rise adds to the temperature, even when it starts below zero.",
        example: "−3 °C plus a 5 degree rise is 2 °C.",
        hard: true,
        name: "Add a rise to a temperature below zero",
        topic: "Temperature changes",
        useCase: "Reading a weather forecast.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Temperature changes across zero",
  };
}

const numberLineActivity = {
  check: {
    answer: 5,
    explanation: "−3 + 8 = 5, so it's 5 °C at noon.",
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
  prompt: "At 7 am it's −3 °C. By noon it's 8 degrees warmer.",
};

/** A written lesson for `temperatureSpec` that passes every code check. */
export function writtenTemperatureLesson(): WrittenLesson {
  return {
    screens: [
      {
        image: null,
        kind: "hookGuess",
        options: [
          { isCorrect: true, text: "2 °C" },
          { isCorrect: false, text: "8 °C" },
          { isCorrect: false, text: "−8 °C" },
        ],
        question: "It's −3 °C at dawn and it warms up 5 degrees. What does the thermometer show?",
        reveal: "It shows 2 °C. Guessing first helps you remember the rule.",
      },
      {
        exampleLineIdea: "A cold morning where the learner lives.",
        image: {
          alt: "A thermometer with an arrow going up past zero.",
          prompt: "A thermometer from −5 °C to 5 °C.",
        },
        kind: "explanation",
        text: "A rise always moves **up** the thermometer. From −3 °C, going up 3 degrees takes you to zero.",
        title: "Up is up, even below zero",
      },
      {
        image: null,
        kind: "workedExample",
        problem: "It's −3 °C and the temperature rises 5 degrees. What's the new temperature?",
        result: "It's 2 °C: two degrees above zero.",
        steps: [
          { math: "-3 + 3 = 0", text: "First climb to zero: that takes 3 degrees." },
          { math: "0 + 2 = 2", text: "Two degrees are left, so keep going up." },
        ],
        title: "From −3 °C, up 5 degrees",
      },
      {
        context: null,
        correctReason: "You start at {start} °C and move {rise} degrees up.",
        kind: "mathCheck",
        math: {
          answer: 3,
          commonMistakes: [
            {
              expression: "rise - start",
              misconception: "Subtracts the negative start",
              reason: "You took the start away instead of adding the rise to it.",
            },
            {
              expression: "start - rise",
              misconception: "Moves down instead of up",
              reason: "A rise moves up the thermometer, not down.",
            },
          ],
          solution: "start + rise",
          steps: [
            {
              expression: "start + rise",
              text: "Move {rise} degrees up from {start} °C: {result} °C.",
            },
          ],
          tolerance: { kind: "absolute", value: 0 },
          unit: "°C",
          variables: [
            { max: -1, min: -10, name: "start", step: 1, unit: "°C", value: -4 },
            { max: 15, min: 2, name: "rise", step: 1, unit: "°C", value: 7 },
          ],
        },
        question:
          "At 6 am it was {start} °C. By noon it warmed up {rise} degrees. What's the temperature now?",
      },
      {
        exampleLineIdea: null,
        image: null,
        kind: "explanation",
        text: "Zero is just a mark on the way up. Count the degrees to zero, then the degrees after it.",
        title: "Zero is a stop, not a wall",
      },
      { content: JSON.stringify(numberLineActivity), kind: "activity", template: "numberLine" },
      {
        acceptedAnswers: [],
        context: null,
        keyPoints: ["Going up 3 degrees reaches zero", "The last 2 degrees go above zero"],
        kind: "typedAnswer",
        question: "Explain in your own words why −3 °C plus 5 degrees is 2 °C.",
        sampleAnswer: "Three degrees get you to zero, and the other two take you to 2 °C.",
      },
      {
        context:
          "It's −6 °C on a winter morning in Chicago, and the forecast says it will warm up 9 degrees.",
        image: null,
        kind: "check",
        options: [
          {
            isCorrect: true,
            reason: "Six degrees reach zero and three more go above it.",
            text: "3 °C",
          },
          {
            isCorrect: false,
            reason: "That's what you get by moving down 9 degrees instead of up.",
            text: "−15 °C",
          },
          {
            isCorrect: false,
            reason: "You added the numbers without their signs: the start is below zero.",
            text: "15 °C",
          },
        ],
        question: "What will the thermometer show?",
      },
    ],
    summary: [
      "A rise moves up the thermometer, even below zero.",
      "Count up to zero first, then the degrees above it.",
    ],
  };
}
