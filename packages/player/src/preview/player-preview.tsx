"use client";

import { SpeechPlayerProvider, type VoiceText } from "@zoonk/learn/speech/provider";
import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { useLessonPlayer } from "../lesson/lesson-player-context";
import { LessonPlayerProvider } from "../lesson/lesson-player-provider";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import {
  type LessonPlayerAdapters,
  type PlayableLibraryLesson,
} from "../lesson/lesson-player-types";
import { type PlayerLinkComponent } from "../player-context";
import { rightAnswer } from "./preview-answers";
import { type PreviewState } from "./preview-catalog";
import { localAdapters } from "./preview-lesson";

function PreviewLink({
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

const noVoice: VoiceText = () => Promise.resolve({ limit: null, status: "failed" });

const ROUTES = { exit: "/", exitTo: null, nextLesson: null, signUp: "/", upgrade: "/" } as const;

function noop() {
  return null;
}

function previewAdapters(lesson: PlayableLibraryLesson): LessonPlayerAdapters {
  const local = localAdapters(lesson);

  return {
    ...local,
    checkStep: (input) => {
      const step = lesson.steps.find((item) => item.id === input.stepId);

      if (step?.kind !== "typedAnswer") {
        return local.checkStep(input);
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
        status: "checked",
      });
    },
    getLessonPictures: () => Promise.resolve([]),
  };
}

function CheckPreviewAnswer({ enabled }: { enabled: boolean }) {
  const { actions } = useLessonPlayer();
  const checked = useRef(false);
  const check = useEffectEvent(actions.check);

  useEffect(() => {
    if (enabled && !checked.current) {
      checked.current = true;
      check();
    }
  }, [enabled]);

  return null;
}

export function PlayerPreview({
  lesson,
  state,
}: {
  lesson: PlayableLibraryLesson;
  state: PreviewState;
}) {
  const adapters = useMemo(() => previewAdapters(lesson), [lesson]);
  const [first] = lesson.steps;

  if (!first) {
    return null;
  }

  return (
    <SpeechPlayerProvider voice={noVoice}>
      <LessonPlayerProvider
        adapters={adapters}
        firstAnswer={state === "checked" ? rightAnswer(first) : null}
        key={`${lesson.id}:${state}`}
        lesson={lesson}
        linkComponent={PreviewLink}
        onExit={noop}
        routes={ROUTES}
        viewer={{ hasSession: true }}
      >
        <CheckPreviewAnswer enabled={state === "checked" && first.kind !== "hook"} />
        <LessonPlayerShell />
      </LessonPlayerProvider>
    </SpeechPlayerProvider>
  );
}
