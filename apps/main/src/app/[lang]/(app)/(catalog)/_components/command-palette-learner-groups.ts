"use client";

import { type ReadyMistakesResponse } from "@/app/api/learner/ready-mistakes/route";
import { getMenu } from "@/lib/menu";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";
import { type LearnBuddy, useBuddyName } from "@zoonk/learn/buddy-name";
import { useFormatDuration } from "@zoonk/learn/time-format";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import {
  type PaletteGroup,
  type PaletteItem,
  createAskPaletteItem,
  createContinuePaletteItem,
  createExplanationPaletteItem,
  createGoalPaletteItem,
  createNavigationPaletteItem,
} from "./command-palette-items";

/**
 * What the app's frame adds to the palette for anyone with a session: their goals (switched from
 * the keyboard, saved by the host's action as the goal switcher saves them) and quick explanations
 * (newest first, each opening itself); the active goal's places as the sidebar lists them; today's
 * next block, for "Continue"; and whether the buddy can take a question (`canAskBuddy`: the active
 * goal is one it tutors), with its own name when the learner gave it one.
 */
export type LearnerPalette = {
  activeGoalId: string | null;
  buddy: Pick<LearnBuddy, "kind" | "name">;
  canAskBuddy: boolean;
  explanations: { id: string; title: string }[];
  goals: { id: string; kind: string; title: string }[];
  onSwitchGoal: (goalId: string) => Promise<void>;
  places: LearnerSummary["places"];
  today: LearnerSummary["today"];
};

/** The active goal's mistakes ready to practice; zero when the read can't tell. */
async function fetchReadyMistakes(goalId: string, signal: AbortSignal): Promise<number> {
  const response = await fetch(`/api/learner/ready-mistakes?${new URLSearchParams({ goalId })}`, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    return 0;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Main's own route answers with this shape.
  const body = (await response.json()) as ReadyMistakesResponse;
  return body.ready;
}

/**
 * The active goal's mistakes ready to practice, read each time the palette opens (and dropped when
 * it closes): the notebook's own count, too costly for every page. A read that fails can't tell
 * what's ready, so the palette offers no practice until one can.
 */
function useReadyMistakes({ goalId, isOpen }: { goalId: string | null; isOpen: boolean }): number {
  const [ready, setReady] = useState<{ count: number; goalId: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !goalId) {
      return;
    }

    const read = new AbortController();

    void fetchReadyMistakes(goalId, read.signal).then(
      (count) => setReady({ count, goalId }),
      () => !read.signal.aborted && setReady({ count: 0, goalId }),
    );

    return () => read.abort();
  }, [goalId, isOpen]);

  return ready && ready.goalId === goalId ? ready.count : 0;
}

/** Rows a learner only has in some cases are left out as `false` or `null` while listed. */
function isPaletteItem(item: PaletteItem | false | null): item is PaletteItem {
  return Boolean(item);
}

/**
 * Continue today's session, with its next block's name and minutes: the lesson's title when it
 * has one, otherwise the minutes alone.
 */
function useContinueItem(today: LearnerSummary["today"]): PaletteItem | null {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const next = today?.next;

  if (!next) {
    return null;
  }

  const minutes = formatDuration(next.minutes);

  return createContinuePaletteItem({
    label: t("Continue today's session"),
    meta: next.title ? `${next.title} · ${minutes}` : minutes,
    sessionId: next.sessionId,
  });
}

/**
 * The learner's actions first (continue the day, take a mock exam, practice their mistakes, ask
 * the buddy), then where they can go (the tabs in their order and the goal's places, as the
 * sidebar lists them), then their other goals. A query also finds a new goal, the catalog and the
 * quick explanations. Null outside the app (a visitor).
 */
export function useLearnerPaletteGroups({
  isOpen,
  learner,
  searching,
}: {
  isOpen: boolean;
  learner?: LearnerPalette;
  searching: boolean;
}): PaletteGroup[] | null {
  const t = useExtracted();
  const continueItem = useContinueItem(learner?.today ?? null);
  const buddy = useBuddyName(learner?.buddy ?? null);

  /** The goal switcher falls back to the first goal when none is saved as active yet. */
  const activeGoalId = learner ? (learner.activeGoalId ?? learner.goals[0]?.id ?? null) : null;
  const readyMistakes = useReadyMistakes({ goalId: activeGoalId, isOpen });

  if (!learner) {
    return null;
  }

  const { places } = learner;

  const actions = [
    continueItem,
    places.exam &&
      createNavigationPaletteItem({
        chip: t("full, half or one subject"),
        id: "mock",
        label: t("Take a mock exam"),
        menu: getMenu("mock"),
      }),
    readyMistakes > 0 &&
      createNavigationPaletteItem({
        count: readyMistakes,
        id: "practice-mistakes",
        label: t("Practice your mistakes"),
        menu: getMenu("mistakesPractice"),
      }),
    // A query asks with its own words, in the last group.
    !searching &&
      learner.canAskBuddy &&
      createAskPaletteItem({ label: t("Ask {buddy}…", { buddy }), question: "" }),
    searching &&
      createNavigationPaletteItem({
        id: "start",
        label: t("Start a new goal"),
        menu: getMenu("start"),
      }),
  ].filter((item) => isPaletteItem(item));

  const goTo = [
    createNavigationPaletteItem({ id: "today", label: t("Today"), menu: getMenu("today") }),
    createNavigationPaletteItem({ id: "journey", label: t("Plan"), menu: getMenu("journey") }),
    createNavigationPaletteItem({
      id: "buddy",
      keywords: t("Buddy"),
      label: buddy,
      menu: getMenu("buddy"),
    }),
    createNavigationPaletteItem({
      count: readyMistakes,
      id: "mistakes",
      label: t("Mistakes notebook"),
      menu: getMenu("mistakes"),
    }),
    places.exam &&
      createNavigationPaletteItem({ id: "exam", label: t("Exam"), menu: getMenu("exam") }),
    places.speaking &&
      createNavigationPaletteItem({
        id: "speaking",
        label: t("Speaking"),
        menu: getMenu("speaking"),
      }),
    places.mindMaps &&
      createNavigationPaletteItem({
        id: "mind-maps",
        label: t("Mind maps"),
        menu: getMenu("mindMaps"),
      }),
    createNavigationPaletteItem({ id: "logbook", label: t("Logbook"), menu: getMenu("logbook") }),
    createNavigationPaletteItem({ id: "stats", label: t("Statistics"), menu: getMenu("stats") }),
    searching &&
      createNavigationPaletteItem({
        id: "courses",
        label: t("Explore courses"),
        menu: getMenu("courses"),
      }),
  ].filter((item) => isPaletteItem(item));

  const otherGoals = learner.goals
    .filter((goal) => goal.id !== activeGoalId)
    .map((goal) =>
      createGoalPaletteItem({
        goalId: goal.id,
        label: t("Switch to {goal}", { goal: goal.title }),
      }),
    );

  const explanations = searching
    ? learner.explanations.map(({ id, title }) =>
        createExplanationPaletteItem({ goalId: id, title }),
      )
    : [];

  return [
    { id: "actions", items: actions, label: t("Actions") },
    { id: "pages", items: goTo, label: t("Go to") },
    { id: "goals", items: otherGoals, label: t("Your goals") },
    { id: "explanations", items: explanations, label: t("Quick explanations") },
  ];
}
