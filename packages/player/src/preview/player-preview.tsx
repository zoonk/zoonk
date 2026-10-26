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

/** A link that stays on the preview: following it would leave the screen being looked at. */
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

/** Without the speech service, sounds don't play: their buttons say so. */
const noVoice: VoiceText = () => Promise.resolve({ limit: null, status: "failed" });

const ROUTES = { exit: "/", exitTo: null, nextLesson: null, signUp: "/", upgrade: "/" } as const;

function noop() {
  return null;
}

/**
 * The local adapters, plus written answers given full credit without judging key points, since
 * only the server grades them.
 */
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
    // No picture is ever drawn here, so a screen waiting on one keeps waiting, as it looks then.
    getLessonPictures: () => Promise.resolve([]),
  };
}

/** Checked gallery screens use only this preview's in-memory adapters, never an AI endpoint. */
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

/**
 * One screen of the player's catalog (`previewEntries`) played in the real player, with the
 * server stood in for: answering, read, explored on an explanation screen, or checked with its
 * right answer. For the playground app; nothing it does is saved.
 *
 * ```tsx
 * <PlayerPreview lesson={previewLesson(entry, "checked")} state="checked" />
 * ```
 */
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
