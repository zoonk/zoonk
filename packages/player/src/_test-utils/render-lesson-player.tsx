import { render } from "@testing-library/react";
import {
  type PlayableLibraryLesson,
  type PlayableTeachingStepOf,
} from "@zoonk/core/lesson-player/contract";
import { gradeStepAnswer } from "@zoonk/core/lesson-player/grade";
import { type ReactNode } from "react";
import { vi } from "vitest";
import {
  LessonPlayerProvider,
  type LessonPlayerProviderProps,
} from "../lesson/lesson-player-provider";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { focusSkin } from "../lesson/skins/focus-skin";
import { funSkin } from "../lesson/skins/fun-skin";
import { type PlayerLinkComponent } from "../player-context";

/** How an app presents the player; the skin and the tokens follow it. */
export type PlayerMode = "focus" | "fun";

/** A link that stays on the page: following it would navigate away from the test's frame. */
export function TestLink({
  "aria-keyshortcuts": keyShortcuts,
  children,
  className,
  href,
}: Parameters<PlayerLinkComponent>[0]) {
  return (
    <a
      aria-keyshortcuts={keyShortcuts}
      className={className}
      href={href}
      onClick={(event) => event.preventDefault()}
    >
      {children}
    </a>
  );
}

/**
 * Adapters that answer like the server: the run starts, each answer is graded the way the server
 * grades it (with the same function the device uses), and the lesson completes. Tests pass their
 * own adapter to change one answer.
 */
export function buildAdapters(
  lesson: PlayableLibraryLesson,
  overrides: Partial<LessonPlayerAdapters> = {},
): LessonPlayerAdapters {
  return {
    checkStep: vi.fn<LessonPlayerAdapters["checkStep"]>(({ answer, stepId }) => {
      const step = lesson.steps.find((item) => item.id === stepId);
      const graded = step ? gradeStepAnswer({ answer, step }) : null;

      if (!graded) {
        return Promise.resolve({ status: "failed" as const });
      }

      return Promise.resolve({
        result: {
          correctAnswer: graded.correctAnswer,
          feedback: graded.feedback,
          isCorrect: graded.isCorrect,
          keyPoints: null,
          nextReviewAt: null,
          savedMistake: !graded.isCorrect,
          score: null,
          spelling: null,
        },
        status: "checked" as const,
      });
    }),
    completeLesson: vi.fn(() =>
      Promise.resolve({
        completion: {
          brainPower: 10,
          correctCount: 1,
          energyDelta: 1,
          incorrectCount: 0,
          isFirstCompletion: true,
          nextReviewAt: null,
          seconds: 60,
          studyBlock: null,
          totalBrainPower: 10,
        },
        status: "completed" as const,
      }),
    ),
    startLesson: vi.fn(() =>
      Promise.resolve({
        hyperdrive: { knownStepIds: [], streak: 0 },
        reason: "started" as const,
        runId: crypto.randomUUID(),
      }),
    ),
    ...overrides,
  };
}

/**
 * The server settles an accepted written answer in code: right, with every key point met. Written
 * answers are graded only on the server, so this stands in for its verdict.
 */
export function acceptedAnswerCheck(
  step: PlayableTeachingStepOf<"typedAnswer">,
): LessonPlayerAdapters["checkStep"] {
  return vi.fn<LessonPlayerAdapters["checkStep"]>(({ answer }) => {
    const accepted = step.content.acceptedAnswers ?? [];

    if (answer.kind !== "typedAnswer" || !accepted.includes(answer.text)) {
      return Promise.resolve({ status: "failed" as const });
    }

    return Promise.resolve({
      result: {
        correctAnswer: null,
        feedback: null,
        isCorrect: true,
        keyPoints: step.content.keyPoints.map((text) => ({ met: true, text })),
        nextReviewAt: null,
        savedMistake: false,
        score: 1,
        spelling: null,
      },
      status: "checked" as const,
    });
  });
}

/** A lesson of the given screens, in the order given. */
export function buildLesson(
  steps: PlayableLibraryLesson["steps"],
  overrides: Partial<PlayableLibraryLesson> = {},
): PlayableLibraryLesson {
  return {
    canDo: null,
    chapter: null,
    description: "A lesson for the player's browser tests",
    estimatedMinutes: 5,
    id: crypto.randomUUID(),
    language: "en",
    level: "beginner",
    skills: [],
    steps: steps.map((step, position) => ({ ...step, position })),
    summaryIdeas: [],
    targetLanguage: null,
    title: "Test lesson",
    ...overrides,
  };
}

/**
 * Plays a lesson the way an app hosts it: the real provider and shell in the mode's skin, inside
 * the mode's root so Fun's tokens apply, with adapters standing in for the server.
 */
export function renderLessonPlayer({
  adapters,
  children = <LessonPlayerShell />,
  lesson,
  mode = "focus",
  ...props
}: Partial<Omit<LessonPlayerProviderProps, "children" | "lesson" | "skin">> & {
  children?: ReactNode;
  lesson: PlayableLibraryLesson;
  mode?: PlayerMode;
}) {
  const onExit = vi.fn();

  const view = render(
    <div className="contents" data-mode={mode} data-slot="mode-root">
      <LessonPlayerProvider
        adapters={adapters ?? buildAdapters(lesson)}
        lesson={lesson}
        linkComponent={TestLink}
        onExit={onExit}
        routes={{ exit: "/", signUp: "/login", upgrade: "/subscription" }}
        skin={mode === "fun" ? funSkin : focusSkin}
        viewer={{ hasSession: true }}
        {...props}
      >
        {children}
      </LessonPlayerProvider>
    </div>,
    { reactStrictMode: true },
  );

  return { ...view, onExit };
}
