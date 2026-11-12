import { type LessonStepCheckResult } from "@zoonk/core/lesson-player/contract";
import { type PlayableLibraryStep } from "@zoonk/core/lesson-player/playable-lesson";
import { NOTHING_REACHED } from "@zoonk/core/sessions/reached";
import { type MistakePracticeFeedback, MistakePracticeRun } from "@zoonk/learn/mistakes/practice";
import { LearnProvider } from "@zoonk/learn/provider";
import { MathMarkupProvider } from "@zoonk/learn/rich-text/math-provider";
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
      <MathMarkupProvider markup={{}}>
        <SpeechPlayerProvider voice={speechClips().voice}>
          <MistakePracticeRun
            actions={actions}
            backHref="/mistakes"
            lessonHref={null}
            practice={[
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
            ]}
            renderLesson={(props) => <LessonPracticeStep {...props} />}
            trueFalseLabels="trueFalse"
          />
        </SpeechPlayerProvider>
      </MathMarkupProvider>
    </LearnProvider>,
  );

  return actions;
}

export type Question = ComponentProps<
  typeof MistakePracticeRun
>["practice"][number]["questions"][number];
type Format = "numeric" | "typed" | "order" | "matchPairs";

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
