import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogActiveShortcutLink } from "@/components/catalog/catalog-active-shortcut-link";
import {
  ContinueLessonLink,
  ContinueLessonLinkSkeleton,
} from "@/components/catalog/continue-lesson-link";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { getSession } from "@/data/users/get-session";
import { getUserHiddenLessonKinds } from "@/data/users/lesson-filter-settings";
import { type Lesson, type LessonKind } from "@zoonk/db";
import { GridToolbar } from "@zoonk/ui/components/grid";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterHeader } from "./chapter-header";

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

/**
 * Loads the chapter identity and learner actions independently from the lesson
 * grid so a cold request can stream whichever catalog section resolves first.
 */
export async function ChapterSidebar({
  params,
}: Pick<PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">, "params">) {
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
  );
}
