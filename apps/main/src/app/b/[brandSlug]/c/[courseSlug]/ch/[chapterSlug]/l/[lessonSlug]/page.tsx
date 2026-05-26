import { LoginRequired } from "@/components/auth/login-required";
import { getLesson as getCatalogLesson } from "@/data/lessons/get-lesson";
import { getLessonDisplayMeta, getLessonSeoMeta } from "@/lib/lessons";
import { getBlockingLessonGenerationPrerequisite } from "@zoonk/core/lessons/generation-prerequisites";
import { getNextChapterInCourse } from "@zoonk/core/lessons/next-chapter-in-course";
import { getNextLessonInCourse } from "@zoonk/core/lessons/next-in-course";
import { startLesson } from "@zoonk/core/player/commands/start-lesson";
import { preparePlayerLessonData } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { getChapterDistractorWords } from "@zoonk/core/player/queries/get-chapter-distractor-words";
import { getChapterSentenceWordsForIds } from "@zoonk/core/player/queries/get-chapter-sentence-words";
import { getChapterSentencesForIds } from "@zoonk/core/player/queries/get-chapter-sentences";
import { getChapterWordsForIds } from "@zoonk/core/player/queries/get-chapter-words";
import { getLesson as getPlayerLesson } from "@zoonk/core/player/queries/get-lesson";
import { getPlayerResourceIds } from "@zoonk/core/player/queries/get-player-resource-ids";
import { getTotalBrainPower } from "@zoonk/core/player/queries/get-total-brain-power";
import { getSession } from "@zoonk/core/users/session/get";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { fetchReviewLessonData } from "./lesson-data-loaders";
import { LessonNotGenerated } from "./lesson-not-generated";
import { LessonPlayerClient } from "./lesson-player-client";
import { ReviewLessonEmpty } from "./review-lesson-empty";

type Props = PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;
type LessonShell = NonNullable<Awaited<ReturnType<typeof getCatalogLesson>>>;
type LessonSession = Awaited<ReturnType<typeof getSession>>;
type PlayerLesson = NonNullable<Awaited<ReturnType<typeof getPlayerLesson>>>;

/**
 * The public lesson preview is intentionally only the first lesson in the
 * first chapter. Later lessons may include progression-dependent review,
 * preload, and completion behavior, so anonymous learners need to sign in
 * before the player loads them.
 */
function canPlayWithoutSession(lesson: { position: number; chapter: { position: number } }) {
  return lesson.chapter.position === 0 && lesson.position === 0;
}

/**
 * Keeps anonymous users out of player-only queries unless they are opening the
 * public preview lesson. The login wall needs the lesson title, so this lives
 * beside the route instead of inside a generic auth component.
 */
async function getAnonymousLessonGate({
  brandSlug,
  chapterSlug,
  courseSlug,
  lesson,
  session,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lesson: LessonShell;
  session: LessonSession;
}) {
  if (session || canPlayWithoutSession(lesson)) {
    return null;
  }

  const backHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const lessonMeta = await getLessonDisplayMeta(lesson);
  const t = await getExtracted();

  return (
    <LoginRequired backHref={backHref} backLabel={t("Back to chapter")} title={lessonMeta.title} />
  );
}

/**
 * Generation recovery links only apply to AI-owned lessons. Courses from other
 * organizations can still show the not-generated state, but they should not
 * expose AI generation prerequisite links.
 */
async function getAiBlockingLessonGenerationPrerequisite({
  brandSlug,
  lesson,
}: {
  brandSlug: string;
  lesson: PlayerLesson;
}) {
  if (brandSlug !== AI_ORG_SLUG) {
    return null;
  }

  return getBlockingLessonGenerationPrerequisite(lesson);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;
  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    return {};
  }

  return getLessonSeoMeta(lessonShell);
}

export default async function LessonPage({ params }: Props) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;

  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    notFound();
  }

  const session = await getSession();

  const anonymousGate = await getAnonymousLessonGate({
    brandSlug,
    chapterSlug,
    courseSlug,
    lesson: lessonShell,
    session,
  });

  if (anonymousGate) {
    return anonymousGate;
  }

  const [lesson, nextChapter, nextLesson, reviewLessonData, totalBrainPower] = await Promise.all([
    getPlayerLesson({ lessonId: lessonShell.id }),
    getNextChapterInCourse({
      chapterPosition: lessonShell.chapter.position,
      courseId: lessonShell.chapter.course.id,
    }),
    getNextLessonInCourse({
      chapterId: lessonShell.chapter.id,
      chapterPosition: lessonShell.chapter.position,
      courseId: lessonShell.chapter.course.id,
      lessonPosition: lessonShell.position,
    }),
    fetchReviewLessonData(lessonShell.id),
    getTotalBrainPower(),
  ]);

  if (!lesson) {
    notFound();
  }

  if (lesson.generationStatus !== "completed") {
    const blockingPrerequisite = await getAiBlockingLessonGenerationPrerequisite({
      brandSlug,
      lesson,
    });

    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <LessonNotGenerated
          brandSlug={brandSlug}
          chapterSlug={chapterSlug}
          courseSlug={courseSlug}
          lessonId={lesson.id}
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

  const steps = reviewSteps ?? lesson.steps;
  const resourceIds = getPlayerResourceIds({ steps });

  const [distractorWords, chapterWords, chapterSentences, sentenceWords] = await Promise.all([
    getChapterDistractorWords(resourceIds),
    getChapterWordsForIds({ chapterWordIds: resourceIds.chapterWordIds }),
    getChapterSentencesForIds({ chapterSentenceIds: resourceIds.chapterSentenceIds }),
    getChapterSentenceWordsForIds({ chapterSentenceIds: resourceIds.chapterSentenceIds }),
  ]);

  const serialized = preparePlayerLessonData({
    chapterSentences,
    chapterWords,
    distractorWords,
    lesson,
    sentenceWords,
    steps,
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
      lessonSlug={lessonSlug}
      lessonTitle={lessonMeta.title}
      nextChapter={nextChapter}
      nextLesson={nextLesson}
      totalBrainPower={totalBrainPower}
      userEmail={session?.user.email}
      userName={session?.user.name ?? null}
    />
  );
}
