import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogActiveShortcutLink } from "@/components/catalog/catalog-active-shortcut-link";
import { CatalogDetailLayout } from "@/components/catalog/catalog-detail-layout";
import { CatalogGridSkeleton } from "@/components/catalog/catalog-skeletons";
import {
  ContinueLessonLink,
  ContinueLessonLinkSkeleton,
} from "@/components/catalog/continue-lesson-link";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { getUserHiddenLessonKinds } from "@/data/users/lesson-filter-settings";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getSession } from "@zoonk/core/users/session/get";
import { type Lesson, type LessonKind } from "@zoonk/db";
import { Grid, GridToolbar } from "@zoonk/ui/components/grid";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterHeader } from "./chapter-header";
import { ChapterNotGenerated } from "./chapter-not-generated";
import { LessonList } from "./lesson-list";

/**
 * Chapter fallbacks are only used when the shared continue target cannot find
 * a destination. They still need to honor hidden lesson kinds so a filtered-out
 * lesson never becomes the backup route.
 */
function getFirstVisibleLesson({
  hiddenLessonKinds,
  lessons,
}: {
  hiddenLessonKinds: LessonKind[];
  lessons: Lesson[];
}) {
  const hiddenLessonKindSet = new Set(hiddenLessonKinds);

  return lessons.find((lesson) => !hiddenLessonKindSet.has(lesson.kind));
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const chapter = await getChapter({ brandSlug, chapterSlug, courseSlug });

  if (!chapter) {
    return {};
  }

  return {
    alternates: {
      canonical: getLocalizedUrl({
        href: `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}`,
        language: chapter.course.language,
      }),
    },
    description: chapter.description,
    robots: { follow: true, index: chapter.generationStatus === "completed" },
    title: chapter.title,
  };
}

export default async function ChapterPage({
  params,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">) {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const [chapter, hiddenLessonKinds, session] = await Promise.all([
    getChapter({ brandSlug, chapterSlug, courseSlug }),
    getUserHiddenLessonKinds(),
    getSession(),
  ]);

  if (!chapter) {
    notFound();
  }

  const lessons = await listChapterLessons({ chapterId: chapter.id });

  const shouldShowCreateChapterPrompt = brandSlug === AI_ORG_SLUG && lessons.length === 0;

  const firstVisibleLesson = getFirstVisibleLesson({ hiddenLessonKinds, lessons });

  const fallbackHref = firstVisibleLesson
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${firstVisibleLesson.slug}` as const)
    : undefined;

  return (
    <CatalogDetailLayout
      sidebar={
        <>
          <ChapterHeader
            brandSlug={brandSlug}
            chapter={chapter}
            courseSlug={courseSlug}
            variant="sidebar"
          />
          {!shouldShowCreateChapterPrompt && (
            <GridToolbar>
              <Suspense fallback={<ContinueLessonLinkSkeleton />}>
                <ContinueLessonLink
                  chapterId={chapter.id}
                  excludedLessonKinds={hiddenLessonKinds}
                  fallbackHref={fallbackHref}
                />
              </Suspense>
              <Suspense fallback={null}>
                <CatalogActiveShortcutLink
                  excludedLessonKinds={hiddenLessonKinds}
                  items={lessons}
                  kind="lesson"
                  scope={{ chapterId: chapter.id }}
                />
              </Suspense>
              <CatalogActions
                defaultEmail={session?.user.email}
                feedbackTarget={{ chapterSlug, courseSlug, kind: "chapter" }}
              />
            </GridToolbar>
          )}
        </>
      }
    >
      <Grid variant="pane">
        {shouldShowCreateChapterPrompt ? (
          <ChapterNotGenerated
            chapterId={chapter.id}
            courseHref={`/b/${brandSlug}/c/${courseSlug}`}
          />
        ) : (
          <Suspense
            fallback={<CatalogGridSkeleton count={lessons.length} groupVariant="pane" search />}
          >
            <LessonList
              brandSlug={brandSlug}
              chapterId={chapter.id}
              chapterSlug={chapterSlug}
              courseSlug={courseSlug}
              hiddenLessonKinds={hiddenLessonKinds}
              isLanguageCourse={Boolean(chapter.course.targetLanguage)}
              lessons={lessons}
            />
          </Suspense>
        )}
      </Grid>
    </CatalogDetailLayout>
  );
}
