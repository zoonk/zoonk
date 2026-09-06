"use client";

import { GenerationLimitAction } from "@/components/generation/generation-limit-cta";
import { Link, useRouter } from "@/i18n/navigation";
import { getWorkflowAuthHeaders } from "@/lib/workflow/auth-headers";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerInitialProgress } from "@zoonk/core/player/contracts/progress-snapshot";
import { PlayerProvider, type PlayerQuestionSupport } from "@zoonk/player/provider";
import {
  type LessonQuestionConnection,
  type LessonQuestionLimitActionProps,
  LessonQuestionPanel,
  useLessonQuestions,
} from "@zoonk/player/questions";
import { PlayerShell } from "@zoonk/player/shell";
import { API_URL } from "@zoonk/utils/url";
import { memo, useMemo } from "react";
import { getPlayerViewer } from "./get-player-viewer";
import {
  type LessonProgressMeta,
  type NextChapterTarget,
  buildLessonPlayerModel,
} from "./lesson-player-model";
import { useLessonPlayerHandlers } from "./use-lesson-player-handlers";

const questionConnection: LessonQuestionConnection = {
  apiUrl: API_URL,
  getHeaders: getWorkflowAuthHeaders,
};

function renderQuestionLimitAction({
  className,
  loginHref,
  viewer,
}: LessonQuestionLimitActionProps) {
  return (
    <GenerationLimitAction
      className={className}
      loginHref={loginHref}
      variant="outline"
      viewer={viewer}
    />
  );
}

type LessonPlayerClientProps = {
  lesson: SerializedLesson;
  brandSlug: string;
  chapterPosition: number;
  chapterTitle: string;
  courseTitle: string;
  courseSlug: string;
  chapterSlug: string;
  isAuthenticated: boolean;
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
    connection: questionConnection,
    isAuthenticated,
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
        navigation={{
          linkComponent: Link,
          loginHref: model.navigation.loginHref ?? "/login",
          renderLimitAction: renderQuestionLimitAction,
          subscriptionHref: "/subscription",
        }}
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
