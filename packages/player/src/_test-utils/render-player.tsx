"use client";

import { render } from "@testing-library/react";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { PlayerShell } from "../components/player-shell";
import { type PlayerMilestone, type PlayerNavigation, type PlayerViewer } from "../player-context";
import { PlayerProvider } from "../player-provider";

const noop = () => null;

/**
 * Browser tests should exercise the same public surface as consuming apps. This
 * helper mounts the real provider and shell together so scenarios interact with
 * the full shared player flow instead of leaf components.
 */
export function renderPlayer({
  lesson,
  chapterTitle = "Test Chapter",
  lessonDescription = "Test lesson description",
  lessonTitle = "Test Lesson",
  milestone = null,
  navigation = buildNavigation(),
  onComplete = noop,
  onEscape = noop,
  onNext,
  totalBrainPower = 0,
  viewer = { isAuthenticated: false, userName: null },
}: {
  lesson: SerializedLesson;
  chapterTitle?: string;
  lessonDescription?: string;
  lessonTitle?: string;
  milestone?: PlayerMilestone | null;
  navigation?: PlayerNavigation;
  onComplete?: (input: CompletionInput) => void;
  onEscape?: () => void;
  onNext?: () => void;
  totalBrainPower?: number;
  viewer?: PlayerViewer;
}) {
  return render(
    <PlayerProvider
      lesson={lesson}
      chapterTitle={chapterTitle}
      lessonDescription={lessonDescription}
      lessonTitle={lessonTitle}
      milestone={milestone}
      navigation={navigation}
      onComplete={onComplete}
      onEscape={onEscape}
      onNext={onNext}
      totalBrainPower={totalBrainPower}
      viewer={viewer}
    >
      <PlayerShell />
    </PlayerProvider>,
  );
}

/**
 * Most shared tests only need stable placeholder routes so they can assert the
 * visible links exposed by the player contract.
 */
export function buildNavigation(overrides: Partial<PlayerNavigation> = {}): PlayerNavigation {
  return {
    chapterHref: "/chapter",
    courseHref: "/course",
    lessonHref: "/lesson",
    levelHref: "/level",
    loginHref: "/login",
    nextLessonHref: "/lesson/play",
    ...overrides,
  };
}
