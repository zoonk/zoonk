"use client";

import { render } from "@testing-library/react";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerProgressSnapshot } from "../completion-milestones";
import { PlayerShell } from "../components/player-shell";
import {
  type PlayerLessonProgress,
  type PlayerMilestone,
  type PlayerNavigation,
  type PlayerViewer,
} from "../player-context";
import { PlayerProvider } from "../player-provider";

const noop = () => null;

const TEST_LESSON_KIND_LABELS: Record<SerializedLesson["kind"], string> = {
  alphabet: "Alphabet",
  custom: "Lesson",
  explanation: "Explanation",
  grammar: "Grammar",
  listening: "Listening",
  practice: "Practice",
  quiz: "Quiz",
  reading: "Reading",
  review: "Review",
  translation: "Translation",
  tutorial: "Tutorial",
  vocabulary: "Vocabulary",
};

/**
 * Test renders should mirror the app's display-title contract. Apps pass the
 * resolved lesson title into the provider, so this helper derives the same
 * English fallback for browser tests that only provide serialized lesson data.
 */
function getDefaultLessonTitle(lesson: SerializedLesson) {
  if (lesson.title) {
    return lesson.title;
  }

  return TEST_LESSON_KIND_LABELS[lesson.kind];
}

/**
 * Browser tests should exercise the same public surface as consuming apps. This
 * helper mounts the real provider and shell together so scenarios interact with
 * the full shared player flow instead of leaf components.
 */
export function renderPlayer({
  lesson,
  chapterTitle = "Test Chapter",
  courseTitle = "Test Course",
  lessonDescription = "Test lesson description",
  lessonProgress = buildLessonProgress(),
  lessonTitle = getDefaultLessonTitle(lesson),
  milestone = null,
  navigation = buildNavigation(),
  onComplete = noop,
  onEscape = noop,
  onNext,
  progressSnapshot = null,
  totalBrainPower = 0,
  viewer = { isAuthenticated: false, userName: null },
}: {
  lesson: SerializedLesson;
  chapterTitle?: string;
  courseTitle?: string;
  lessonDescription?: string;
  lessonProgress?: PlayerLessonProgress;
  lessonTitle?: string;
  milestone?: PlayerMilestone | null;
  navigation?: PlayerNavigation;
  onComplete?: (input: CompletionInput) => void;
  onEscape?: () => void;
  onNext?: () => void;
  progressSnapshot?: PlayerProgressSnapshot | null;
  totalBrainPower?: number;
  viewer?: PlayerViewer;
}) {
  return render(
    <PlayerProvider
      lesson={lesson}
      chapterTitle={chapterTitle}
      courseTitle={courseTitle}
      lessonDescription={lessonDescription}
      lessonProgress={lessonProgress}
      lessonTitle={lessonTitle}
      milestone={milestone}
      navigation={navigation}
      onComplete={onComplete}
      onEscape={onEscape}
      onNext={onNext}
      progressSnapshot={progressSnapshot}
      totalBrainPower={totalBrainPower}
      viewer={viewer}
    >
      <PlayerShell />
    </PlayerProvider>,
  );
}

/**
 * Most shared player tests do not care about curriculum position. This default
 * keeps the public provider contract realistic without making every scenario
 * restate one-lesson progress metadata.
 */
function buildLessonProgress(overrides: Partial<PlayerLessonProgress> = {}): PlayerLessonProgress {
  return {
    currentLessonNumber: 1,
    remainingChaptersInCourse: 0,
    remainingLessonsInChapter: 0,
    totalLessonsInChapter: 1,
    ...overrides,
  };
}

/**
 * Most shared tests only need stable placeholder routes so they can assert the
 * visible links exposed by the player contract.
 */
export function buildNavigation(overrides: Partial<PlayerNavigation> = {}): PlayerNavigation {
  return {
    chapterHref: "/chapter",
    courseHref: "/course",
    energyHref: "/energy",
    levelHref: "/level",
    loginHref: "/login",
    nextLessonHref: "/lesson/play",
    ...overrides,
  };
}
