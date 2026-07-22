import { GeneratedCourseCacheRefresher } from "@/components/catalog/generated-course-cache-refresher";
import { UpgradeCTA } from "@/components/subscription/upgrade-cta";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { type CatalogLesson, getLesson as getCatalogLesson } from "@/data/lessons/get-lesson";
import { getNextLessonInCourse } from "@/data/lessons/get-next-lesson-in-course";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { getPlayerProgressSnapshot } from "@/data/progress/get-player-progress-snapshot";
import { hasActiveSubscription } from "@/data/subscriptions/get-active-subscription";
import { getSession } from "@/data/users/get-session";
import { redirect } from "@/i18n/navigation";
import { getLessonDisplayMeta, getLessonSeoMeta } from "@/lib/lessons";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getLessonAccessRequirement } from "@zoonk/core/lessons/access";
import { isStandaloneGeneratedLessonKind } from "@zoonk/core/lessons/generated-companion-kinds";
import {
  getSourceLessonForGeneratedCompanion,
  isGeneratedCompanionLessonKind,
} from "@zoonk/core/lessons/generated-companions";
import { preparePlayerLessonData } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerLesson } from "@zoonk/core/player/queries/get-lesson";
import { getPlayerResourceIds } from "@zoonk/core/player/queries/get-player-resource-ids";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fetchReviewLessonData, getPlayerLesson, getPlayerResources } from "./lesson-data-loaders";
import { LessonNotGenerated } from "./lesson-not-generated";
import { LessonPlayerClient } from "./lesson-player-client";
import { buildLessonProgressMeta, getNextChapterTarget } from "./lesson-player-model";
import { ReviewLessonEmpty } from "./review-lesson-empty";

type Props = PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

export const prefetch = "allow-runtime";

/**
 * Preserves the player's spatial frame on a cold navigation while lesson data
 * streams. Runtime-prefetched navigations resolve this fallback before click.
 */
function LessonPlayerSkeleton() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-3 py-1.5 sm:p-4">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </header>

      <Skeleton className="h-0.5 w-full rounded-none" />

      <section className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <Skeleton className="h-6 w-3/4 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-sm" />
      </section>

      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Skeleton className="h-10 w-full rounded-4xl" />
      </div>
    </main>
  );
}

/**
 * Stops the player route before expensive player queries when the lesson sits
 * outside the free first chapter. Later chapters require an active
 * subscription even if the lesson content was already generated.
 */
async function getLessonAccessGate({
  brandSlug,
  chapterSlug,
  courseSlug,
  lesson,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lesson: CatalogLesson;
}) {
  const requirement = getLessonAccessRequirement({ lesson });

  if (requirement === "free") {
    return null;
  }

  const backHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const t = await getExtracted();

  const hasSubscription = await hasActiveSubscription();

  if (hasSubscription) {
    return null;
  }

  return (
    <Container className="min-h-dvh" variant="narrow">
      <ContainerBody className="justify-center sm:flex-1">
        <UpgradeCTA
          backHref={backHref}
          backLabel={t("Back to chapter")}
          title={t("Unlock the rest of this course")}
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
  locale,
}: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lesson: PlayerLesson;
  locale: string;
}): Promise<void> {
  if (brandSlug !== AI_ORG_SLUG || !isGeneratedCompanionLessonKind(lesson.kind)) {
    return;
  }

  const sourceLesson = await getSourceLessonForGeneratedCompanion(lesson);

  if (sourceLesson) {
    return redirect({
      href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${sourceLesson.slug}`,
      locale,
    });
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;
  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    return {};
  }

  return {
    ...(await getLessonSeoMeta(lessonShell)),
    alternates: {
      canonical: getLocalizedUrl({
        href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
        language: lessonShell.chapter.course.language,
      }),
    },
    robots: { follow: true, index: false },
  };
}

/**
 * Loads the runtime-specific lesson inside the page's explicit streaming
 * boundary so Cache Components can prerender the route shell.
 */
async function LessonContent({ params }: Pick<Props, "params">) {
  const { brandSlug, chapterSlug, courseSlug, lang: locale, lessonSlug } = await params;

  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    notFound();
  }

  const accessGate = await getLessonAccessGate({
    brandSlug,
    chapterSlug,
    courseSlug,
    lesson: lessonShell,
  });

  if (accessGate) {
    return accessGate;
  }

  const [
    session,
    lesson,
    nextLesson,
    reviewLessonData,
    progressSnapshot,
    chapterLessons,
    courseChapters,
  ] = await Promise.all([
    getSession(),
    getPlayerLesson(lessonShell.id),
    getNextLessonInCourse({
      chapterId: lessonShell.chapter.id,
      chapterPosition: lessonShell.chapter.position,
      courseId: lessonShell.chapter.course.id,
      lessonPosition: lessonShell.position,
    }),
    fetchReviewLessonData(lessonShell.id),
    getPlayerProgressSnapshot(),
    listChapterLessons({ chapterId: lessonShell.chapter.id }),
    listCourseChapters({ courseId: lessonShell.chapter.course.id }),
  ]);

  if (!lesson) {
    notFound();
  }

  if (lesson.generationStatus !== "completed") {
    await redirectGeneratedCompanionToSourceLesson({
      brandSlug,
      chapterSlug,
      courseSlug,
      lesson,
      locale,
    });

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

  const reviewSteps = reviewLessonData?.steps ?? null;

  const steps = reviewSteps ?? lesson.steps;
  const resourceIds = getPlayerResourceIds({ steps });

  const [lessonMeta, resources] = await Promise.all([
    getLessonDisplayMeta(lesson),
    getPlayerResources({ ...resourceIds, lessonId: lesson.id }),
  ]);

  await io();

  const serialized = preparePlayerLessonData({
    chapterSentences: resources.chapterSentences,
    chapterWords: resources.chapterWords,
    distractorWords: resources.distractorWords,
    lesson,
    sentenceWords: resources.sentenceWords,
    steps,
  });

  const lessonProgress = buildLessonProgressMeta({
    chapterId: lessonShell.chapter.id,
    chapterLessons,
    courseChapters,
    lessonId: lessonShell.id,
  });

  const nextChapter = getNextChapterTarget({
    brandSlug,
    chapterId: lessonShell.chapter.id,
    courseChapters,
    courseSlug,
  });

  return (
    <>
      {lessonShell.chapter.course.generationStatus === "running" && (
        <GeneratedCourseCacheRefresher courseId={lessonShell.chapter.course.id} />
      )}

      <LessonPlayerClient
        lesson={serialized}
        brandSlug={brandSlug}
        chapterPosition={lessonShell.chapter.position}
        chapterTitle={lessonShell.chapter.title}
        courseTitle={lessonShell.chapter.course.title}
        courseSlug={courseSlug}
        chapterSlug={chapterSlug}
        isAuthenticated={Boolean(session)}
        lessonDescription={lessonMeta.description}
        lessonProgress={lessonProgress}
        lessonPosition={lessonShell.position}
        lessonSlug={lessonSlug}
        lessonTitle={lessonMeta.title}
        nextChapter={nextChapter}
        nextLesson={nextLesson}
        progressSnapshot={progressSnapshot}
        totalBrainPower={progressSnapshot?.totalBrainPower ?? 0}
        userEmail={session?.user.email}
        userName={session?.user.name ?? null}
      />
    </>
  );
}

export default function LessonPage({ params }: Props) {
  return (
    <Suspense fallback={<LessonPlayerSkeleton />}>
      <LessonContent params={params} />
    </Suspense>
  );
}
