import { getLesson as getCatalogLesson } from "@/data/lessons/get-lesson";
import { getLessonSeoMeta } from "@/lib/lessons";
import { getNextLessonInCourse } from "@zoonk/core/lessons/next-in-course";
import { startLesson } from "@zoonk/core/player/commands/start-lesson";
import { preparePlayerLessonData } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { getLesson as getPlayerLesson } from "@zoonk/core/player/queries/get-lesson";
import { getLessonDistractorWordsForLessons } from "@zoonk/core/player/queries/get-lesson-distractor-words";
import { getLessonSentencesForLessons } from "@zoonk/core/player/queries/get-lesson-sentences";
import { getLessonWordsForLessons } from "@zoonk/core/player/queries/get-lesson-words";
import { getSentenceWordsForLessons } from "@zoonk/core/player/queries/get-sentence-words";
import { getTotalBrainPower } from "@zoonk/core/player/queries/get-total-brain-power";
import { getSession } from "@zoonk/core/users/session/get";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { fetchNextSibling, fetchReviewSteps } from "./lesson-data-loaders";
import { LessonNotGenerated } from "./lesson-not-generated";
import { LessonPlayerClient } from "./lesson-player-client";

type Props = PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

/**
 * Review lessons replay steps from previous lessons, so the player resources
 * must come from those source lessons. Normal lessons keep using their own id.
 */
function getPlayerResourceLessonIds({
  lessonId,
  reviewSteps,
}: {
  lessonId: string;
  reviewSteps: { lessonId: string }[] | null;
}) {
  if (!reviewSteps) {
    return [lessonId];
  }

  return [...new Set(reviewSteps.map((step) => step.lessonId))];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;
  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    return {};
  }

  const lesson = await getPlayerLesson({ lessonId: lessonShell.id });

  if (!lesson) {
    return {};
  }

  return getLessonSeoMeta(lesson, lesson.title);
}

export default async function LessonPage({ params }: Props) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;

  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    notFound();
  }

  const [lesson, nextLesson, session, reviewSteps, nextSibling, totalBrainPower] =
    await Promise.all([
      getPlayerLesson({ lessonId: lessonShell.id }),
      getNextLessonInCourse({
        chapterId: lessonShell.chapter.id,
        chapterPosition: lessonShell.chapter.position,
        courseId: lessonShell.chapter.course.id,
        lessonId: lessonShell.id,
        lessonPosition: lessonShell.position,
      }),
      getSession(),
      fetchReviewSteps(lessonShell.id),
      fetchNextSibling(lessonShell.id, lessonShell.chapter, lessonShell.position),
      getTotalBrainPower(),
    ]);

  if (!lesson) {
    notFound();
  }

  if (lesson.generationStatus !== "completed") {
    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <LessonNotGenerated lessonId={lesson.id} brandSlug={brandSlug} />
      </main>
    );
  }

  const resourceLessonIds = getPlayerResourceLessonIds({
    lessonId: lessonShell.id,
    reviewSteps,
  });

  const [distractorWords, lessonWords, lessonSentences, sentenceWords] = await Promise.all([
    getLessonDistractorWordsForLessons({ lessonIds: resourceLessonIds }),
    getLessonWordsForLessons({ lessonIds: resourceLessonIds }),
    getLessonSentencesForLessons({ lessonIds: resourceLessonIds }),
    getSentenceWordsForLessons({ lessonIds: resourceLessonIds }),
  ]);

  const serialized = preparePlayerLessonData({
    distractorWords,
    lesson,
    lessonSentences,
    lessonWords,
    sentenceWords,
    steps: reviewSteps ?? lesson.steps,
  });

  if (session) {
    after(() => startLesson({ lessonId: lesson.id, userId: session.user.id }));
  }

  return (
    <LessonPlayerClient
      lesson={serialized}
      brandSlug={brandSlug}
      chapterTitle={lessonShell.chapter.title}
      courseSlug={courseSlug}
      chapterSlug={chapterSlug}
      isAuthenticated={Boolean(session)}
      lessonDescription={lesson.description}
      lessonTitle={lesson.title}
      nextLesson={nextLesson}
      nextSibling={nextSibling}
      totalBrainPower={totalBrainPower}
      userEmail={session?.user.email}
      userName={session?.user.name ?? null}
    />
  );
}
