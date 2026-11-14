import { type LessonStepCheckResult } from "@zoonk/core/lesson-player/contract";
import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/playable-lesson";
import { NOTHING_REACHED } from "@zoonk/core/sessions/reached";
import { type MistakePracticeFeedback, MistakePracticeRun } from "@zoonk/learn/mistakes/practice";
import { LearnProvider } from "@zoonk/learn/provider";
import { DrawnMath } from "@zoonk/learn/rich-text/drawn-math";
import { SpeechPlayerProvider } from "@zoonk/learn/speech/provider";
import { type ComponentProps } from "react";
import { vi } from "vitest";
import { LessonPracticeStep } from "../lesson/lesson-practice-step";
import { render } from "./render";
import { speechClips } from "./speech-clips";

export type Actions = ComponentProps<typeof MistakePracticeRun>["actions"];

function result(checked = true): LessonStepCheckResult {
  return {
    checked,
    correctAnswer: null,
    corrections: [],
    expected: null,
    feedback: "The original answer was checked.",
    isCorrect: checked,
    keyPoints: null,
    savedMistake: false,
    score: null,
    spelling: null,
  };
}

export function practiceFeedback(checked = true): NonNullable<MistakePracticeFeedback> {
  return {
    answerId: checked ? "saved-answer" : null,
    correctAnswer: null,
    explanation: null,
    fixed: checked,
    fixedMistakeIds: checked ? ["original-mistake"] : [],
    isCorrect: checked,
    lessonResult: result(checked),
    mistakeStatus: checked ? "fixed" : "open",
    reached: NOTHING_REACHED,
    trap: null,
    workedSteps: [],
  };
}

export function openPractice(
  step: PlayableLibraryStep | null,
  overrides: Partial<Actions> = {},
  question?: ComponentProps<typeof MistakePracticeRun>["practice"][number]["questions"][number],
) {
  const answer = vi.fn<Actions["answer"]>().mockResolvedValue(practiceFeedback());
  const finish = vi.fn<Actions["finish"]>().mockResolvedValue(null);
  const actions = { answer, finish, ...overrides };

  const practice: ComponentProps<typeof MistakePracticeRun>["practice"] = [
    {
      cause: null,
      drill: { kind: "retry", lesson: null, timeLimitSeconds: null },
      lesson: step
        ? {
            language: "en",
            lessonId: "original-lesson",
            level: "beginner",
            step,
            targetLanguage: "en",
          }
        : null,
      mistakeId: "original-mistake",
      questions: question ? [question] : [],
      snapshot: {
        answer: "The earlier answer",
        question: question?.question ?? "The original lesson question",
      },
      tutorAvailable: true,
    },
  ];

  render(
    <LearnProvider
      adapters={{
        analytics: { track: vi.fn() },
        linkComponent: ({ children, href, ...props }) => (
          <a href={href} {...props}>
            {children}
          </a>
        ),
        loadCountries: async () => [],
        routes: {
          buddy: "/buddy",
          journey: "/plan",
          signUp: "/login",
          today: "/today",
          upgrade: "/plus",
        },
      }}
    >
      <DrawnMath content={practice}>
        <SpeechPlayerProvider voice={speechClips().voice}>
          <MistakePracticeRun
            actions={actions}
            backHref="/mistakes"
            lessonHref={null}
            practice={practice}
            renderLesson={(props) => <LessonPracticeStep {...props} />}
            trueFalseLabels="trueFalse"
          />
        </SpeechPlayerProvider>
      </DrawnMath>
    </LearnProvider>,
  );

  return actions;
}

export type Question = ComponentProps<
  typeof MistakePracticeRun
>["practice"][number]["questions"][number];
type Format = "numeric" | "typed" | "order" | "matchPairs" | "multipleChoice";

export function bankQuestion(format: Format): Question {
  const base = {
    context: "The numbers and context from the original question.",
    image: null,
    itemId: "original-bank-item",
    left: null,
    options: null,
    question: "The original bank question",
    right: null,
    select: null,
    set: null,
    skillId: "original-skill",
    unit: null,
    visual: null,
  };

  if (format === "numeric") {
    return {
      ...base,
      entry: { kind: "integer", places: null },
      format,
      question: "What is 20% of 40?",
    };
  }

  if (format === "multipleChoice") {
    return {
      ...base,
      context: String.raw`Simplify $x^4 y \cdot x^2$ when the bill is $5.`,
      entry: null,
      format,
      options: ["$x^6 y$", "$C_{A0} = 2$ mol/L", "$E_a$ = 50 kJ/mol", "costs $5 or $10"],
      question: "Which one is right?",
      select: 1,
    };
  }

  if (format === "typed") {
    return { ...base, entry: null, format };
  }

  if (format === "order") {
    return { ...base, context: null, entry: null, format, options: ["First step", "Second step"] };
  }

  return {
    ...base,
    context: null,
    entry: null,
    format,
    left: ["Electron", "Proton"],
    right: ["Negative charge", "Positive charge"],
  };
}
