import { render } from "@testing-library/react";
import {
  type PlayableLibraryLesson,
  type PlayableTeachingStepOf,
} from "@zoonk/core/lesson-player/contract";
import { SpeechPlayerProvider, type VoiceText } from "@zoonk/learn/speech/provider";
import { type ReactNode } from "react";
import { vi } from "vitest";
import {
  LessonPlayerProvider,
  type LessonPlayerProviderProps,
} from "../lesson/lesson-player-provider";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import { type LessonPlayerAdapters, type LessonStartOutcome } from "../lesson/lesson-player-types";
import { type PlayerLinkComponent } from "../player-context";
import { localAdapters } from "../preview/preview-lesson";
import { speechClips } from "./speech-clips";

/** A link that stays on the page: following it would navigate away from the test's frame. */
export function TestLink({
  "aria-keyshortcuts": keyShortcuts,
  children,
  className,
  href,
  ref,
}: Parameters<PlayerLinkComponent>[0]) {
  return (
    <a
      aria-keyshortcuts={keyShortcuts}
      className={className}
      href={href}
      onClick={(event) => event.preventDefault()}
      ref={ref}
    >
      {children}
    </a>
  );
}

const MS_PER_MINUTE = 60_000;

/** An answer the server already has, given `minutesAgo` before now. */
export function runAnswer({
  isCorrect = true,
  minutesAgo = 1,
  stepId,
}: {
  isCorrect?: boolean;
  minutesAgo?: number;
  stepId: string;
}) {
  return {
    answeredAt: new Date(Date.now() - minutesAgo * MS_PER_MINUTE).toISOString(),
    isCorrect,
    stepId,
  };
}

/** A run the server just started: new, or resumed with the answers it already has. */
export function startedRun({
  answers = [],
  hyperdrive = { knownStepIds: [], streak: 0 },
  optionalStepIds,
  runId = crypto.randomUUID(),
  startedAt = new Date().toISOString(),
}: Partial<Extract<LessonStartOutcome, { reason: "started" }>> = {}) {
  return { answers, hyperdrive, optionalStepIds, reason: "started" as const, runId, startedAt };
}

/**
 * The preview's local adapters (`localAdapters`) as mocks, so tests see each call: answers are
 * graded the way the server grades them. Tests pass their own adapter to change one answer.
 */
export function buildAdapters(
  lesson: PlayableLibraryLesson,
  overrides: Partial<LessonPlayerAdapters> = {},
): LessonPlayerAdapters {
  const local = localAdapters(lesson);

  return {
    checkStep: vi.fn(local.checkStep),
    completeLesson: vi.fn(local.completeLesson),
    startLesson: vi.fn(local.startLesson),
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
        checked: true,
        correctAnswer: null,
        corrections: [],
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

/**
 * Plays a lesson the way an app hosts it: the real provider and shell, with adapters standing in
 * for the server, and `voice` for the speech clips endpoint (short generated clips by default).
 */
export function renderLessonPlayer({
  adapters,
  children = <LessonPlayerShell />,
  lesson,
  voice = speechClips().voice,
  ...props
}: Partial<Omit<LessonPlayerProviderProps, "children" | "lesson">> & {
  children?: ReactNode;
  lesson: PlayableLibraryLesson;
  voice?: VoiceText;
}) {
  const onExit = vi.fn();

  const view = render(
    <SpeechPlayerProvider voice={voice}>
      <LessonPlayerProvider
        adapters={adapters ?? buildAdapters(lesson)}
        lesson={lesson}
        linkComponent={TestLink}
        onExit={onExit}
        routes={{
          exit: "/",
          exitTo: null,
          nextLesson: null,
          signUp: "/login",
          upgrade: "/subscription",
        }}
        viewer={{ hasSession: true }}
        {...props}
      >
        {children}
      </LessonPlayerProvider>
    </SpeechPlayerProvider>,
    { reactStrictMode: true },
  );

  return { ...view, onExit };
}
