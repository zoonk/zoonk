import { GeneratedCourseCacheRefresher } from "@/components/catalog/generated-course-cache-refresher";
import { UpgradeCTA } from "@/components/subscription/upgrade-cta";
import { loadOptionalData } from "@/data/_utils/load-optional-data";
import { getLessonSeoSource } from "@/data/lessons/get-lesson-seo-source";
import { redirect } from "@/i18n/navigation";
import { getLessonDisplayMeta, getLessonSeoMeta } from "@/lib/lessons";
import { isLessonSeoIndexable } from "@/lib/lessons/seo";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { listCourseChapters } from "@zoonk/core/chapters/list-by-course";
import { type CatalogLesson, getLesson as getCatalogLesson } from "@zoonk/core/lessons/get-by-slug";
import { listChapterLessons } from "@zoonk/core/lessons/list-by-chapter";
import { getNextLessonInCourse } from "@zoonk/core/lessons/next-in-course";
import {
  getLessonContent,
  getLessonContentAccess,
} from "@zoonk/core/player/queries/get-playable-lesson";
import { getPlayerProgressSnapshot } from "@zoonk/core/player/queries/get-player-progress-snapshot";
import { getSession } from "@zoonk/core/users/session";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LessonNotGenerated } from "./lesson-not-generated";
import { LessonPlayerClient } from "./lesson-player-client";
import { buildLessonProgressMeta, getNextChapterTarget } from "./lesson-player-model";
import { LessonPageSummary, LessonSummaryStatus } from "./lesson-summary";
import { ReviewLessonEmpty } from "./review-lesson-empty";

type Props = PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

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
 * Renders the web-specific upgrade response for a subscription decision that
 * the shared playable-lesson capability already authorized.
 */
async function getSubscriptionRequiredContent({
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
  const backHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}` as const;
  const t = await getExtracted();

  return (
    <Container className="min-h-dvh" variant="narrow">
      <ContainerBody className="justify-center sm:flex-1">
        <UpgradeCTA backHref={backHref} backLabel={t("Back to chapter")}>
          <LessonPageSummary lesson={lesson} />

          <LessonSummaryStatus>{t("This lesson is included with Plus.")}</LessonSummaryStatus>
        </UpgradeCTA>
      </ContainerBody>
    </Container>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;
  const lessonShell = await getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug });

  if (!lessonShell) {
    return {};
  }

  const sourceLesson = await getLessonSeoSource(lessonShell);
  const sourceTitle = sourceLesson?.title?.trim() || null;

  return {
    ...(await getLessonSeoMeta({ lesson: lessonShell, sourceTitle })),
    alternates: {
      canonical: getLocalizedUrl({
        href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`,
        language: lessonShell.chapter.course.language,
      }),
    },
    robots: {
      follow: true,
      index: isLessonSeoIndexable({
        description: lessonShell.description,
        kind: lessonShell.kind,
        sourceTitle,
        title: lessonShell.title,
      }),
    },
  };
}

/**
 * Loads the runtime-specific lesson inside the page's explicit streaming
 * boundary so Cache Components can prerender the route shell.
 */
async function LessonContent({ params }: Pick<Props, "params">) {
  const { brandSlug, chapterSlug, courseSlug, lang: locale, lessonSlug } = await params;

  const [lessonShell, session] = await Promise.all([
    getCatalogLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug }),
    getSession(),
  ]);

  if (!lessonShell) {
    notFound();
  }

  const access = await getLessonContentAccess(lessonShell.id);

  if (access.status === "unavailable") {
    notFound();
  }

  if (access.status === "subscriptionRequired") {
    return getSubscriptionRequiredContent({
      brandSlug,
      chapterSlug,
      courseSlug,
      lesson: lessonShell,
    });
  }

  const [lessonContent, nextLesson, initialProgress, chapterLessons, courseChapters] =
    await Promise.all([
      getLessonContent(lessonShell.id),
      getNextLessonInCourse({ courseId: lessonShell.chapter.course.id, lessonId: lessonShell.id }),
      loadOptionalData(getPlayerProgressSnapshot),
      listChapterLessons({ chapterId: lessonShell.chapter.id }),
      listCourseChapters({ courseId: lessonShell.chapter.course.id }),
    ]);

  if (lessonContent.status === "unavailable") {
    notFound();
  }

  if (lessonContent.status === "subscriptionRequired") {
    return getSubscriptionRequiredContent({
      brandSlug,
      chapterSlug,
      courseSlug,
      lesson: lessonShell,
    });
  }

  if (lessonContent.status === "notGenerated") {
    if (lessonContent.generationTarget?.kind === "sourceLesson") {
      return redirect({
        href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonContent.generationTarget.lessonSlug}`,
        locale,
      });
    }

    const generationLessonId =
      lessonContent.generationTarget?.kind === "lesson"
        ? lessonContent.generationTarget.lessonId
        : null;

    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <LessonNotGenerated
          brandSlug={brandSlug}
          chapterSlug={chapterSlug}
          courseSlug={courseSlug}
          generationLessonId={generationLessonId}
        >
          <LessonPageSummary lesson={lessonShell} />
        </LessonNotGenerated>
      </main>
    );
  }

  if (lessonContent.status === "reviewEmpty") {
    const generationLessonId = brandSlug === AI_ORG_SLUG ? lessonContent.generationLessonId : null;

    return (
      <main className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center p-4">
        <ReviewLessonEmpty generationLessonId={generationLessonId}>
          <LessonPageSummary lesson={lessonShell} />
        </ReviewLessonEmpty>
      </main>
    );
  }

  const lesson = lessonContent.lesson;
  const lessonMeta = await getLessonDisplayMeta(lesson);

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
        lesson={lesson}
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
        initialProgress={initialProgress}
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
