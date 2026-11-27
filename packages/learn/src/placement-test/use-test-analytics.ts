"use client";

import { type AnalyticsEvent } from "@zoonk/core/analytics/events";
import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import { useLearnAnalytics } from "../learn-context";

type Properties<Name extends AnalyticsEvent["name"]> = Extract<
  AnalyticsEvent,
  { name: Name }
>["properties"];

type Offered = Properties<"Test Offered">;

export type TestRowId = Offered["preselected"];
type TestSurface = Offered["surface"];
type TestKind = Offered["test"];

/** The server's facts about the sitting on screen; null where it has none yet. */
export type TestFactsNow = {
  attemptId?: string | null;
  part?: number | null;
  parts?: number | null;
  questions?: number | null;
};

export type TestIdentity = { goalId: string; surface: TestSurface; test: TestKind };

/**
 * What only the client can know about a test: an offer on screen, the first question on screen
 * with the wait before it, a tap on ✕, a lesson opened from a result and a "Not now". The server
 * sends every other test event from its own writes.
 */
export function useTestAnalytics({ goalId, surface, test }: TestIdentity) {
  const { track } = useLearnAnalytics();
  const visit = useRef<{ at: number; started: boolean } | null>(null);

  return useMemo(() => {
    const context = (now: TestFactsNow = {}) => ({
      attempt_id: now.attemptId ?? null,
      goal_id: goalId,
      part: now.part ?? null,
      parts: now.parts ?? null,
      questions: now.questions ?? null,
      surface,
      test,
    });

    return {
      firstQuestionShown: ({ number, ...now }: TestFactsNow & { number: number }) => {
        const { at, started } = visit.current ?? { at: Date.now(), started: false };

        track({
          name: "Test First Question Shown",
          properties: {
            ...context(now),
            question_number: number,
            resumed: !started,
            wait_ms: Date.now() - at,
          },
        });
      },
      left: ({ number, ...now }: TestFactsNow & { number: number }) =>
        track({ name: "Test Left", properties: { ...context(now), question_number: number } }),
      lessonStarted: ({ lessonId, ...now }: TestFactsNow & { lessonId: string }) =>
        track({
          name: "Test Lesson Started",
          properties: { ...context(now), lesson_id: lessonId },
        }),
      /** The screen opened: a question that shows before any start is a sitting resumed. */
      markOpened: () => {
        visit.current = { at: Date.now(), started: false };
      },
      /** The learner started or continued a sitting: the wait for its first question begins. */
      markStarted: () => {
        visit.current = { at: Date.now(), started: true };
      },
      notNow: (now: TestFactsNow = {}) => {
        if (surface === "plan") {
          track({ name: "Test Skipped", properties: { ...context(now), row: "not_now" } });
        }
      },
      offered: ({
        preselected,
        rows,
        ...now
      }: TestFactsNow & { preselected: TestRowId; rows: readonly TestRowId[] }) =>
        track({
          name: "Test Offered",
          properties: { ...context(now), preselected, rows: rows.join(",") },
        }),
    };
  }, [goalId, surface, test, track]);
}

export type TestAnalytics = ReturnType<typeof useTestAnalytics>;

/** Runs once each time its screen is put on screen, such as an offer. */
export function useShown(onShown: (() => void) | undefined) {
  const shown = useEffectEvent(() => onShown?.());

  useEffect(() => {
    shown();
  }, []);
}

/** Says the first question of each sitting the learner sees; `sitting` is null off a question. */
export function useFirstQuestionShown({
  onShown,
  sitting,
}: {
  onShown: () => void;
  sitting: string | null;
}) {
  const said = useRef<string | null>(null);
  const shown = useEffectEvent(onShown);

  useEffect(() => {
    if (sitting && said.current !== sitting) {
      said.current = sitting;
      shown();
    }
  }, [sitting]);
}
