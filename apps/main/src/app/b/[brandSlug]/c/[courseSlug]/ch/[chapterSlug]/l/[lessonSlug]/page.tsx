import { LoginRequired } from "@/components/auth/login-required";
import { UpgradeCTA } from "@/components/subscription/upgrade-cta";
import { getLesson as getCatalogLesson } from "@/data/lessons/get-lesson";
import { getLessonDisplayMeta, getLessonSeoMeta } from "@/lib/lessons";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { getLessonAccessRequirement } from "@zoonk/core/lessons/access";
import { isStandaloneGeneratedLessonKind } from "@zoonk/core/lessons/generated-companion-kinds";
import {
  getSourceLessonForGeneratedCompanion,
  isGeneratedCompanionLessonKind,
} from "@zoonk/core/lessons/generated-companions";
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
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
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
 * Stops the player route before expensive player queries when the lesson sits
 * outside the viewer's free window. Lessons 6-10 ask anonymous learners to log
 * in, while lesson 11+ and later chapters require an active subscription even
 * if the lesson content was already generated.
 */
async function getLessonAccessGate({
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
  const requirement = getLessonAccessRequirement({ isAuthenticated: Boolean(session), lesson });

  if (requirement === "free") {
    return null;
  }

  const backHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const lessonMeta = await getLessonDisplayMeta(lesson);
  const t = await getExtracted();

  if (requirement === "authentication") {
    return (
      <LoginRequired
        backHref={backHref}
        backLabel={t("Back to chapter")}
        title={lessonMeta.title}
      />
    );
  }

  const hasSubscription = await hasActiveSubscription(await headers());

  if (hasSubscription) {
    return null;
  }

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{lessonMeta.title}</ContainerTitle>
          <ContainerDescription>{lessonMeta.description}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <UpgradeCTA
          backHref={backHref}
          backLabel={t("Back to chapter")}
          description={t("This lesson requires an active subscription.")}
          title={t("Upgrade to keep learning")}
        />
      </ContainerBody>
    </Container>
  );
}

async function getNotGeneratedStandaloneGenerationId({
  brandSlug,
  lesson,
}: {
  brandSlug: string;
  lesson: PlayerLesson;
}): Promise<string | null> {
  if (brandSlug !== AI_ORG_SLUG) {
    return null;
  }

  if (isStandaloneGeneratedLessonKind(lesson.kind)) {
    return lesson.id;
  }

  return null;
}

async function redirectGeneratedCompanionToSourceLesson({
  brandSlug,
  chapterSlug,
  courseSlug,
  lesson,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lesson: PlayerLesson;
}): Promise<void> {
  if (brandSlug !== AI_ORG_SLUG || !isGeneratedCompanionLessonKind(lesson.kind)) {
    return;
  }

  const sourceLesson = await getSourceLessonForGeneratedCompanion(lesson);

  if (sourceLesson) {
    redirect(`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${sourceLesson.slug}`);
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;
  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    return {};
  }

  return { ...(await getLessonSeoMeta(lessonShell)), robots: { follow: true, index: false } };
}

export default async function LessonPage({ params }: Props) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;

  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    notFound();
  }

  const session = await getSession();

  const accessGate = await getLessonAccessGate({
    brandSlug,
    chapterSlug,
    courseSlug,
    lesson: lessonShell,
    session,
  });

  if (accessGate) {
    return accessGate;
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
    await redirectGeneratedCompanionToSourceLesson({ brandSlug, chapterSlug, courseSlug, lesson });
    const generationLessonId = await getNotGeneratedStandaloneGenerationId({ brandSlug, lesson });

    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <LessonNotGenerated
          brandSlug={brandSlug}
          chapterSlug={chapterSlug}
          courseSlug={courseSlug}
          generationLessonId={generationLessonId}
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
