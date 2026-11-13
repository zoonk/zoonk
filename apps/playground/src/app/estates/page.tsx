"use client";

import { SpeechPlayerProvider, type VoiceText } from "@zoonk/learn/speech/provider";
import { LessonPlayerProvider } from "@zoonk/player/lesson";
import { LessonPlayerShell } from "@zoonk/player/lesson/shell";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import {
  PREVIEW_LEARNER_ID,
  buildLesson,
  localAdapters,
} from "../../../../../packages/player/src/preview/preview-lesson";
import { teachingStep } from "../../../../../packages/player/src/preview/preview-steps";
import { PreviewIntlProvider } from "../preview/preview-intl-provider";

// Temporary page for the UX review pack (lane E): real player, hand-built states. Not committed.

const REFUSALS = {
  "access-free-day": { period: "day", reason: "limitReached", tier: "free" },
  "access-free-month": { period: "month", reason: "limitReached", tier: "free" },
  "access-guest": { period: "total", reason: "limitReached", tier: "guest" },
  "access-plus": { period: "day", reason: "limitReached", tier: "plus" },
  "access-slow": { reason: "slowDown", retryAfterSeconds: 12 },
  "access-failed": { reason: "failed" },
  "access-out": { reason: "unauthorized" },
  "access-gone": { reason: "notFound" },
  "access-freeweek": { reason: "plusRequired" },
} as const;

const SAMPLE =
  "Because we can't pin down where the electron is. The cloud maps where it's most likely to be.";

const noVoice: VoiceText = () => Promise.resolve({ limit: null, status: "failed" });
const ROUTES = {
  exit: "/",
  exitTo: null,
  nextLesson: null,
  seePlan: () => "/",
  signUp: "/",
  upgrade: "/",
} as const;

function Link({ children, className, href, ref }: any) {
  return (
    <a className={className} href={href} onClick={(event) => event.preventDefault()} ref={ref}>
      {children}
    </a>
  );
}

function States() {
  const state = useSearchParams().get("state") ?? "";

  const { adapters, lesson } = useMemo(() => {
    const kinds =
      state === "unchecked" || state === "leave"
        ? (["typedAnswer"] as const)
        : state === "streak"
          ? (["check", "check", "check", "check"] as const)
          : state === "completefail"
            ? (["check"] as const)
            : state === "wrong"
              ? (["check", "check"] as const)
              : state === "skipwriting"
                ? (["typedAnswer", "check"] as const)
                : (["explanation", "check"] as const);

    const built = buildLesson(
      kinds.map((kind, index) => teachingStep(kind, { id: `estate-${index}` })) as Parameters<
        typeof buildLesson
      >[0],
      { id: "estates", title: "Why is the electron a cloud?" },
    );

    const local = localAdapters(built);
    const refusal = REFUSALS[state as keyof typeof REFUSALS];

    return {
      adapters: {
        ...local,
        checkStep: (input: Parameters<typeof local.checkStep>[0]) => {
          if (state === "saveerror") {
            return Promise.resolve({ status: "failed" as const });
          }

          if (state === "unchecked") {
            return Promise.resolve({
              result: {
                checked: false,
                correctAnswer: SAMPLE,
                corrections: [],
                expected: null,
                feedback: null,
                isCorrect: false,
                keyPoints: null,
                savedMistake: false,
                score: null,
                spelling: null,
              },
              status: "checked" as const,
            });
          }

          return local.checkStep(input);
        },
        completeLesson:
          state === "completefail"
            ? () => Promise.resolve({ status: "failed" as const })
            : local.completeLesson,
        getLessonPictures: () => Promise.resolve([]),
        startLesson: refusal ? () => Promise.resolve(refusal) : local.startLesson,
      },
      lesson: built,
    };
  }, [state]);

  return (
    <SpeechPlayerProvider voice={noVoice}>
      <LessonPlayerProvider
        adapters={adapters}
        firstAnswer={null}
        key={state}
        lesson={lesson}
        linkComponent={Link}
        routes={ROUTES}
        viewer={{ learnerId: PREVIEW_LEARNER_ID }}
      >
        <LessonPlayerShell />
      </LessonPlayerProvider>
    </SpeechPlayerProvider>
  );
}

export default function Page() {
  return (
    <PreviewIntlProvider>
      <Suspense>
        <States />
      </Suspense>
    </PreviewIntlProvider>
  );
}
