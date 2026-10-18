import {
  type PlayableLanguageStep,
  type PlayableTeachingStep,
  type PlayableTeachingStepOf,
  type TeachingStepKind,
} from "@zoonk/core/lesson-player/contract";
import { type LessonStepResult } from "../lesson-player-types";

function teachingStep<TKind extends TeachingStepKind>(
  kind: TKind,
  id: string,
  content: PlayableTeachingStepOf<TKind>["content"],
): PlayableTeachingStepOf<TKind> {
  return {
    citation: null,
    content,
    id,
    image: null,
    imagePending: false,
    kind,
    position: 0,
    skillId: null,
  };
}

export function explanationStep(id: string): PlayableTeachingStep {
  return teachingStep("explanation", id, { text: `Idea ${id}`, title: `Title ${id}` });
}

export function workedExampleStep(id: string): PlayableTeachingStep {
  return teachingStep("workedExample", id, {
    problem: "What is 25% of 80?",
    result: "20",
    steps: [
      { text: "Split 80 into four parts" },
      { text: "Each part is 20" },
      { text: "So 25% is 20" },
    ],
  });
}

export function checkStep(id: string): PlayableTeachingStep {
  return teachingStep("check", id, {
    options: [
      { id: "right", isCorrect: true, reason: "Because it is.", text: "Right" },
      { id: "wrong", isCorrect: false, reason: "That's the trap.", text: "Wrong" },
    ],
    question: `Question ${id}?`,
  });
}

export function hookGuessStep(id: string): PlayableTeachingStep {
  return teachingStep("hook", id, {
    options: [
      { id: "yes", isCorrect: false, text: "Yes" },
      { id: "no", isCorrect: true, text: "No" },
    ],
    question: "Guess?",
    reveal: "No, and here's why.",
    variant: "guess",
  });
}

export function typedAnswerStep(id: string): PlayableTeachingStep {
  return teachingStep("typedAnswer", id, {
    keyPoints: ["Names the cloud"],
    question: "Why a cloud?",
    sampleAnswer: "Because it maps chances.",
  });
}

/** A language exercise: fill the blank in a sentence. */
export function fillBlankStep(id: string): PlayableLanguageStep {
  return {
    exercise: {
      content: {
        answers: ["pay"],
        distractors: ["rent"],
        feedback: "You pay rent.",
        question: "Fill in the blank",
        template: "I [BLANK] rent.",
      },
      fillBlankOptions: [],
      id,
      kind: "fillBlank",
      matchColumnsRightItems: [],
      position: 0,
      sentence: null,
      sentenceWordOptions: [],
      translationOptions: [],
      vocabularyOptions: [],
      word: null,
      wordBankOptions: [],
    },
    id,
    kind: "fillBlank",
    position: 0,
    skillId: null,
    wordHints: null,
  };
}

export function summaryStep(id: string): PlayableTeachingStep {
  return teachingStep("summary", id, { ideas: [{ text: "One idea." }] });
}

export function stepResult(isCorrect: boolean): LessonStepResult {
  return {
    answerText: isCorrect ? "Right" : "Wrong",
    checked: true,
    correctAnswer: isCorrect ? null : "Right",
    corrections: [],
    feedback: isCorrect ? "Because it is." : "That's the trap.",
    heard: null,
    isCorrect,
    keyPoints: null,
    nextReviewAt: null,
    savedMistake: false,
    score: null,
    spelling: null,
  };
}

function note(kind: "good" | "improve", text: string) {
  return [{ kind, skill: "judge", text }];
}

/** A two-decision case: ask the AI (strong) or rush (weak), then ship (strong) or stop (weak). */
export function challengeStep(id: string): PlayableTeachingStepOf<"challenge"> {
  return teachingStep("challenge", id, {
    endings: [
      { id: "shipped", outcome: "It went out and worked." },
      { id: "stopped", outcome: "It never went out." },
    ],
    meters: [{ goodWhen: "low", id: "risk", label: "Risk", start: 50 }],
    mission: "Decide whether to ship.",
    nodes: [
      {
        choices: [
          {
            effects: [{ change: -30, meter: "risk" }],
            id: "ask",
            next: "ship-it",
            notes: note("good", "You checked first."),
            quality: "strong",
            replies: [{ from: "ai", text: "It looks safe." }],
            text: "Ask the AI to check",
          },
          {
            effects: [{ change: 10, meter: "risk" }],
            id: "rush",
            next: "ship-it",
            notes: note("improve", "You rushed."),
            quality: "weak",
            replies: [],
            text: "Decide now",
          },
        ],
        id: "start",
        messages: [{ from: "boss", text: "Can we ship?" }],
        prompt: "What do you do?",
      },
      {
        choices: [
          {
            effects: [],
            id: "ship",
            next: "shipped",
            notes: note("good", "You shipped with evidence."),
            quality: "strong",
            replies: [],
            text: "Ship it",
          },
          {
            effects: [],
            id: "stop",
            next: "stopped",
            notes: note("improve", "You stopped a safe change."),
            quality: "weak",
            replies: [],
            text: "Stop it",
          },
        ],
        id: "ship-it",
        messages: [],
        prompt: "Now what?",
      },
    ],
    panels: [],
    setting: "Day 1 at a shop",
    skills: [{ id: "judge", name: "Judgment", practice: "Name one risk before you decide." }],
    startNodeId: "start",
    team: [
      { ai: false, expertise: "Wants to ship", id: "boss", role: "Manager" },
      { ai: true, expertise: "Runs checks", id: "ai", role: "AI assistant" },
    ],
    title: "Should we ship?",
    variant: "work",
  });
}
