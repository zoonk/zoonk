import {
  type PlayableLibraryLesson,
  type PlayableTeachingStepOf,
} from "@zoonk/core/lesson-player/playable-lesson";
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
  "aria-busy": busy,
  "aria-keyshortcuts": keyShortcuts,
  children,
  className,
  href,
  onClick,
  ref,
}: Parameters<PlayerLinkComponent>[0]) {
  return (
    <a
      aria-busy={busy}
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

export const LEARNER_ID = "learner";

export function startedRun({
  answers = [],
  hyperdrive = { knownStepIds: [], streak: 0 },
  learnerId = LEARNER_ID,
  optionalStepIds,
  replay = false,
  runId = crypto.randomUUID(),
  startedAt = new Date().toISOString(),
}: Partial<Extract<LessonStartOutcome, { reason: "started" }>> = {}) {
  return {
    answers,
    hyperdrive,
    learnerId,
    optionalStepIds,
    reason: "started" as const,
    replay,
    runId,
    startedAt,
  };
}

export function buildAdapters(
  lesson: PlayableLibraryLesson,
  overrides: Partial<LessonPlayerAdapters> = {},
): LessonPlayerAdapters {
  const local = localAdapters(lesson);

  return {
    checkStep: vi.fn(local.checkStep),
    completeLesson: vi.fn(local.completeLesson),
    startLesson: vi.fn(() => Promise.resolve(startedRun())),
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

type LessonPlayerTestProps = Partial<Omit<LessonPlayerProviderProps, "children" | "lesson">> & {
  children?: ReactNode;
  lesson: PlayableLibraryLesson;
  mathMarkup?: ComponentProps<typeof MathMarkupProvider>["markup"];
  voice?: VoiceText;
};

export function lessonPlayerElement({
  adapters,
  children = <LessonPlayerShell />,
  lesson,
  mathMarkup = {},
  voice = speechClips().voice,
  ...props
}: LessonPlayerTestProps) {
  return (
    <MathMarkupProvider markup={mathMarkup}>
      <SpeechPlayerProvider voice={voice}>
        <LessonPlayerProvider
          adapters={adapters ?? buildAdapters(lesson)}
          lesson={lesson}
          linkComponent={TestLink}
          onExit={vi.fn()}
          routes={{
            exit: "/",
            exitTo: null,
            nextLesson: null,
            signUp: "/login",
            upgrade: "/subscription",
          }}
          viewer={{ learnerId: LEARNER_ID }}
          {...props}
        >
          {children}
        </LessonPlayerProvider>
      </SpeechPlayerProvider>
    </MathMarkupProvider>
  );
}

export function renderLessonPlayer(props: LessonPlayerTestProps) {
  const onExit = vi.fn();
  const view = render(lessonPlayerElement({ onExit, ...props }), { reactStrictMode: true });
  return { ...view, onExit };
}
