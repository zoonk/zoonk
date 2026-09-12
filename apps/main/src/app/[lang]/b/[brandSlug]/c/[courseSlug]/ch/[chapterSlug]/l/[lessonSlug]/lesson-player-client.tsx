"use client";

import { GenerationLimitAction } from "@/components/generation/generation-limit-cta";
import { OptionalPractice } from "@/components/learning/optional-practice";
import { Link, useRouter } from "@/i18n/navigation";
import { getWorkflowAuthHeaders } from "@/lib/workflow/auth-headers";
import { type getLessonOptionalActivities } from "@zoonk/core/lessons/optional-activities";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerInitialProgress } from "@zoonk/core/player/contracts/progress-snapshot";
import { PlayerProvider } from "@zoonk/player/provider";
import {
  type LessonQuestionConnection,
  type LessonQuestionLimitActionProps,
  LessonQuestionPanel,
  LessonQuestionProvider,
} from "@zoonk/player/questions";
import { PlayerShell } from "@zoonk/player/shell";
import { buttonVariants } from "@zoonk/ui/components/button";
import { API_URL } from "@zoonk/utils/url";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
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
  courseId: string;
  view: "path" | "curriculum";
  optionalPractice: Awaited<ReturnType<typeof getLessonOptionalActivities>>;
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

export function LessonPlayerClient({
  lesson,
  brandSlug,
  chapterPosition,
  chapterTitle,
  courseTitle,
  courseId,
  optionalPractice,
  view,
  courseSlug,
  chapterSlug,
  isAuthenticated,
  lessonDescription,
  lessonProgress,
  lessonPosition,
  lessonSlug,
  lessonTitle,
  initialProgress,
  nextChapter,
  nextLesson,
  userEmail,
  userName,
}: LessonPlayerClientProps) {
  const {
    completionMilestone,
    completionNextTarget,
    handleComplete,
    handleStepChange,
    isSuperseded,
  } = useLessonPlayerHandlers({
    chapterPosition,
    chapterSlug,
    courseId,
    courseSlug,
    isAuthenticated,
    isPrivate: brandSlug === "me",
    lesson,
    lessonPosition,
    lessonSlug,
  });

  const model = useMemo(
    () =>
      buildLessonPlayerModel({
        brandSlug,
        chapterSlug,
        completionMilestone,
        completionNextTarget:
          view === "path" && !lessonProgress.isOptional ? completionNextTarget : null,
        courseSlug,
        lessonProgress,
        lessonSlug,
        nextChapter,
        nextLesson,
        view,
      }),
    [
      brandSlug,
      completionMilestone,
      completionNextTarget,
      view,
      chapterSlug,
      courseSlug,
      lessonProgress,
      lessonSlug,
      nextChapter,
      nextLesson,
    ],
  );

  const router = useRouter();

  const onNextHref = model.onNextHref;
  const handleNext = onNextHref ? () => router.push(onNextHref) : undefined;

  const viewer = getPlayerViewer({
    chapterSlug,
    courseSlug,
    isAuthenticated,
    isPrivate: brandSlug === "me",
    lessonSlug,
    userEmail,
    userName,
  });

  if (isSuperseded) {
    return <SupersededLesson brandSlug={brandSlug} courseSlug={courseSlug} />;
  }

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
      totalBrainPower={initialProgress?.totalBrainPower ?? 0}
      viewer={{
        ...viewer,
        completionFooter:
          optionalPractice.status === "ready" ? (
            <div className="w-full">
              <OptionalPractice groups={[optionalPractice]} isAuthenticated={isAuthenticated} />
            </div>
          ) : (
            viewer.completionFooter
          ),
      }}
    >
      <LessonQuestionProvider connection={questionConnection} lessonId={lesson.id}>
        <PlayerShell />
        <LessonQuestionPanel
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
      </LessonQuestionProvider>
    </PlayerProvider>
  );
}

function SupersededLesson({ brandSlug, courseSlug }: { brandSlug: string; courseSlug: string }) {
  const t = useExtracted();

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-6"
      role="status"
    >
      <h1 className="text-2xl font-semibold tracking-tight">{t("This course has been updated")}</h1>
      <p className="text-muted-foreground">
        {t(
          "Your earlier progress is saved. This lesson changed before this attempt could be saved. Continue with the current course.",
        )}
      </p>
      <Link className={buttonVariants()} href={`/b/${brandSlug}/c/${courseSlug}?edition=original`}>
        {t("Continue to course")}
      </Link>
    </main>
  );
}
