import { getLesson as getCatalogLesson } from "@/data/lessons/get-lesson";
import { getLessonDisplayMeta, getLessonSeoMeta } from "@/lib/lessons";
import { getBlockingLessonGenerationPrerequisite } from "@zoonk/core/lessons/generation-prerequisites";
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
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { fetchReviewLessonData } from "./lesson-data-loaders";
import { LessonNotGenerated } from "./lesson-not-generated";
import { LessonPlayerClient } from "./lesson-player-client";
import { ReviewLessonEmpty } from "./review-lesson-empty";

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

  const [lesson, nextLesson, session, reviewLessonData, totalBrainPower] = await Promise.all([
    getPlayerLesson({ lessonId: lessonShell.id }),
    getNextLessonInCourse({
      chapterId: lessonShell.chapter.id,
      chapterPosition: lessonShell.chapter.position,
      courseId: lessonShell.chapter.course.id,
      lessonPosition: lessonShell.position,
    }),
    getSession(),
    fetchReviewLessonData(lessonShell.id),
    getTotalBrainPower(),
  ]);

  if (!lesson) {
    notFound();
  }

  if (lesson.generationStatus !== "completed") {
    const blockingPrerequisite =
      brandSlug === AI_ORG_SLUG ? await getBlockingLessonGenerationPrerequisite(lesson) : null;

    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <LessonNotGenerated
          lessonId={lesson.id}
          brandSlug={brandSlug}
          prerequisiteLessonId={blockingPrerequisite?.lessonId ?? null}
        />
      </main>
    );
  }

  if (lesson.kind === "review" && (!reviewLessonData || reviewLessonData.steps.length === 0)) {
    const generationLessonId =
      brandSlug === AI_ORG_SLUG ? (reviewLessonData?.generationLessonId ?? null) : null;

    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <ReviewLessonEmpty generationLessonId={generationLessonId} />
      </main>
    );
  }

  const lessonMeta = await getLessonDisplayMeta(lesson);
  const reviewSteps = reviewLessonData?.steps ?? null;

  const resourceLessonIds = getPlayerResourceLessonIds({ lessonId: lessonShell.id, reviewSteps });

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
      lessonDescription={lessonMeta.description}
      lessonTitle={lessonMeta.title}
      nextLesson={nextLesson}
      totalBrainPower={totalBrainPower}
      userEmail={session?.user.email}
      userName={session?.user.name ?? null}
    />
  );
}
