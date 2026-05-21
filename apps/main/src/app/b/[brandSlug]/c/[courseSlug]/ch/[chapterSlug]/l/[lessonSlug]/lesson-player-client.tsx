"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { PlayerProvider, type PlayerStepChangeEvent } from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { buildLessonPlayerModel } from "./lesson-player-model";
import { preloadNextLesson } from "./preload-next-lesson-action";
import { submitCompletion } from "./submit-completion-action";

export function LessonPlayerClient({
  lesson,
  brandSlug,
  chapterTitle,
  courseSlug,
  chapterSlug,
  isAuthenticated,
  lessonDescription,
  lessonTitle,
  nextChapter,
  nextLesson,
  totalBrainPower,
  userEmail,
  userName,
}: {
  lesson: SerializedLesson;
  brandSlug: string;
  chapterTitle: string;
  courseSlug: string;
  chapterSlug: string;
  isAuthenticated: boolean;
  lessonDescription: string;
  lessonTitle: string;
  nextChapter: { brandSlug: string; chapterSlug: string; courseSlug: string } | null;
  nextLesson: { chapterSlug: string; lessonSlug: string; lessonTitle: string | null } | null;
  totalBrainPower: number;
  userEmail?: string;
  userName: string | null;
}) {
  const router = useRouter();
  const hasRequestedNextLessonPreload = useRef(false);

  const model = buildLessonPlayerModel({
    brandSlug,
    chapterSlug,
    courseSlug,
    nextChapter,
    nextLesson,
  });

  const onNextHref = model.onNextHref;
  const handleNext = onNextHref ? () => router.push(onNextHref) : undefined;

  /** Fire-and-forget: the server validates and persists via `after()`. */
  const handleComplete = useCallback((input: CompletionInput) => {
    void submitCompletion(input);
  }, []);

  /** Fire once after the first forward step change; completion handles short lessons. */
  const handleStepChange = useCallback(
    (event: PlayerStepChangeEvent) => {
      if (
        !isAuthenticated ||
        event.direction !== "next" ||
        event.previousStepIndex !== 0 ||
        hasRequestedNextLessonPreload.current
      ) {
        return;
      }

      hasRequestedNextLessonPreload.current = true;
      void preloadNextLesson(event.lessonId);
    },
    [isAuthenticated],
  );

  return (
    <PlayerProvider
      lesson={lesson}
      chapterTitle={chapterTitle}
      lessonDescription={lessonDescription}
      lessonTitle={lessonTitle}
      milestone={model.milestone}
      navigation={model.navigation}
      onComplete={handleComplete}
      onEscape={() => router.push(model.navigation.chapterHref)}
      onNext={handleNext}
      onStepChange={handleStepChange}
      totalBrainPower={totalBrainPower}
      viewer={{
        completionFooter: (
          <ContentFeedback
            className="pt-8"
            contentId={lesson.id}
            defaultEmail={userEmail}
            kind="lesson"
            variant="minimal"
          />
        ),
        isAuthenticated,
        userName,
      }}
    >
      <PlayerShell />
    </PlayerProvider>
  );
}
