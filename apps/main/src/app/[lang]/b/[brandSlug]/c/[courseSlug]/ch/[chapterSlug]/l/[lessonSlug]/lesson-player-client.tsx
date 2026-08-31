"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerInitialProgress } from "@zoonk/core/player/contracts/progress-snapshot";
import { PlayerProvider, type PlayerQuestionSupport } from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { memo, useMemo } from "react";
import { LessonQuestionPanel } from "./_questions/lesson-question-panel";
import { useLessonQuestions } from "./_questions/use-lesson-questions";
import { getPlayerViewer } from "./get-player-viewer";
import {
  type LessonProgressMeta,
  type NextChapterTarget,
  buildLessonPlayerModel,
} from "./lesson-player-model";
import { useLessonPlayerHandlers } from "./use-lesson-player-handlers";

type LessonPlayerClientProps = {
  lesson: SerializedLesson;
  brandSlug: string;
  chapterPosition: number;
  chapterTitle: string;
  courseTitle: string;
  courseSlug: string;
  chapterSlug: string;
  isAuthenticated: boolean;
  isSubscribed: boolean;
  lessonDescription: string;
  lessonProgress: LessonProgressMeta;
  lessonPosition: number;
  lessonSlug: string;
  lessonTitle: string;
  nextChapter: NextChapterTarget | null;
  nextLesson: { chapterSlug: string; lessonSlug: string; lessonTitle: string | null } | null;
  initialProgress: PlayerInitialProgress | null;
  userEmail?: string;
  userName: string | null;
};

type LessonPlayerSurfaceProps = LessonPlayerClientProps & {
  model: ReturnType<typeof buildLessonPlayerModel>;
  questionSupport: PlayerQuestionSupport;
};

/** Keeps token-by-token question updates from re-rendering the active player. */
function LessonPlayerSurfaceComponent({
  lesson,
  chapterPosition,
  chapterTitle,
  courseTitle,
  courseSlug,
  chapterSlug,
  isAuthenticated,
  lessonDescription,
  lessonPosition,
  lessonSlug,
  lessonTitle,
  initialProgress,
  model,
  questionSupport,
  userEmail,
  userName,
}: LessonPlayerSurfaceProps) {
  const router = useRouter();

  const onNextHref = model.onNextHref;
  const handleNext = onNextHref ? () => router.push(onNextHref) : undefined;

  const { handleComplete, handleStepChange } = useLessonPlayerHandlers({
    chapterPosition,
    chapterSlug,
    courseSlug,
    hasMilestone: Boolean(model.milestone),
    isAuthenticated,
    lesson,
    lessonPosition,
    lessonSlug,
  });

  return (
    <PlayerProvider
      lesson={lesson}
      chapterTitle={chapterTitle}
      courseTitle={courseTitle}
      lessonDescription={lessonDescription}
      lessonProgress={model.lessonProgress}
      lessonTitle={lessonTitle}
      linkComponent={Link}
      milestone={model.milestone}
      navigation={model.navigation}
      onComplete={handleComplete}
      onEscape={(href) => router.push(href)}
      onNext={handleNext}
      onStepChange={handleStepChange}
      progressSnapshot={initialProgress?.progressSnapshot ?? null}
      questionSupport={questionSupport}
      totalBrainPower={initialProgress?.totalBrainPower ?? 0}
      viewer={getPlayerViewer({
        chapterSlug,
        courseSlug,
        isAuthenticated,
        lessonSlug,
        userEmail,
        userName,
      })}
    >
      <PlayerShell />
    </PlayerProvider>
  );
}

const LessonPlayerSurface = memo(LessonPlayerSurfaceComponent);

export function LessonPlayerClient(props: LessonPlayerClientProps) {
  const {
    brandSlug,
    chapterSlug,
    chapterTitle,
    courseSlug,
    courseTitle,
    isAuthenticated,
    isSubscribed,
    lesson,
    lessonDescription,
    lessonProgress,
    lessonSlug,
    lessonTitle,
    nextChapter,
    nextLesson,
  } = props;

  const model = useMemo(
    () =>
      buildLessonPlayerModel({
        brandSlug,
        chapterSlug,
        courseSlug,
        lessonProgress,
        lessonSlug,
        nextChapter,
        nextLesson,
      }),
    [brandSlug, chapterSlug, courseSlug, lessonProgress, lessonSlug, nextChapter, nextLesson],
  );

  const questionController = useLessonQuestions({
    isAuthenticated,
    isSubscribed,
    lessonId: lesson.id,
    lessonSteps: lesson.steps,
  });

  return (
    <>
      <LessonPlayerSurface
        {...props}
        model={model}
        questionSupport={questionController.questionSupport}
      />
      <LessonQuestionPanel
        controller={questionController}
        isAuthenticated={isAuthenticated}
        isSubscribed={isSubscribed}
        loginHref={model.navigation.loginHref ?? "/login"}
        metadata={{
          chapterTitle,
          courseTitle,
          lessonDescription,
          lessonSteps: lesson.steps,
          lessonTitle,
        }}
      />
    </>
  );
}
