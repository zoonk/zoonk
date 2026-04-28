"use client";

import { ContentFeedback } from "@/components/feedback/content-feedback";
import { type CompletionInput } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedLesson } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { PlayerProvider } from "@zoonk/player/provider";
import { PlayerShell } from "@zoonk/player/shell";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { buildLessonPlayerModel } from "./lesson-player-model";
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
  nextLesson,
  nextSibling,
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
  nextLesson: {
    chapterSlug: string;
    lessonSlug: string;
    lessonTitle: string | null;
  } | null;
  nextSibling: {
    brandSlug: string;
    chapterSlug: string;
    courseSlug: string;
    lessonSlug: string;
    lessonTitle: string;
  } | null;
  totalBrainPower: number;
  userEmail?: string;
  userName: string | null;
}) {
  const router = useRouter();
  const model = buildLessonPlayerModel({
    brandSlug,
    chapterSlug,
    courseSlug,
    nextLesson,
    nextSibling,
  });
  const onNextHref = model.onNextHref;
  const handleNext = onNextHref ? () => router.push(onNextHref) : undefined;

  /** Fire-and-forget: the server validates and persists via `after()`. */
  const handleComplete = useCallback((input: CompletionInput) => {
    void submitCompletion(input);
  }, []);

  return (
    <PlayerProvider
      lesson={lesson}
      chapterTitle={chapterTitle}
      lessonDescription={lessonDescription}
      lessonTitle={lessonTitle}
      milestone={model.milestone}
      navigation={model.navigation}
      onComplete={handleComplete}
      onEscape={() => router.push(model.navigation.lessonHref)}
      onNext={handleNext}
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
