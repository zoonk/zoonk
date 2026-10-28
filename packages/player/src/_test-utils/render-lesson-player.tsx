import {
  type PlayableLibraryLesson,
  type PlayableTeachingStepOf,
} from "@zoonk/core/lesson-player/contract";
import { MathMarkupProvider } from "@zoonk/learn/rich-text/math-provider";
import { SpeechPlayerProvider, type VoiceText } from "@zoonk/learn/speech/provider";
import { type ComponentProps, type ReactNode } from "react";
import { vi } from "vitest";
import {
  LessonPlayerProvider,
  type LessonPlayerProviderProps,
} from "../lesson/lesson-player-provider";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import { type LessonPlayerAdapters, type LessonStartOutcome } from "../lesson/lesson-player-types";
import { type PlayerLinkComponent } from "../player-context";
import { localAdapters } from "../preview/preview-lesson";
import { render } from "./render";
import { speechClips } from "./speech-clips";

export function TestLink({
  "aria-keyshortcuts": keyShortcuts,
  children,
  className,
  href,
  onClick,
  ref,
}: Parameters<PlayerLinkComponent>[0]) {
  return (
    <a
      aria-keyshortcuts={keyShortcuts}
      className={className}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
      ref={ref}
    >
      {children}
    </a>
  );
}

const MS_PER_MINUTE = 60_000;

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

export function startedRun({
  answers = [],
  hyperdrive = { knownStepIds: [], streak: 0 },
  optionalStepIds,
  runId = crypto.randomUUID(),
  startedAt = new Date().toISOString(),
}: Partial<Extract<LessonStartOutcome, { reason: "started" }>> = {}) {
  return { answers, hyperdrive, optionalStepIds, reason: "started" as const, runId, startedAt };
}

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
        expected: null,
        feedback: null,
        isCorrect: true,
        keyPoints: null,
        nextReviewAt: null,
        savedMistake: false,
        score: 1,
        spelling: null,
      },
      status: "checked" as const,
    });
  });
}

export function renderLessonPlayer({
  adapters,
  children = <LessonPlayerShell />,
  lesson,
  mathMarkup = {},
  voice = speechClips().voice,
  ...props
}: Partial<Omit<LessonPlayerProviderProps, "children" | "lesson">> & {
  children?: ReactNode;
  lesson: PlayableLibraryLesson;
  mathMarkup?: ComponentProps<typeof MathMarkupProvider>["markup"];
  voice?: VoiceText;
}) {
  const onExit = vi.fn();

  const view = render(
    <MathMarkupProvider markup={mathMarkup}>
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
      </SpeechPlayerProvider>
    </MathMarkupProvider>,
    { reactStrictMode: true },
  );

  return { ...view, onExit };
}
