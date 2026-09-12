import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogActiveShortcutLink } from "@/components/catalog/catalog-active-shortcut-link";
import {
  ContinueLessonLink,
  ContinueLessonLinkSkeleton,
} from "@/components/catalog/continue-lesson-link";
import { Link } from "@/i18n/navigation";
import { getChapter } from "@zoonk/core/chapters/get-by-slug";
import { listChapterLessons } from "@zoonk/core/lessons/list-by-chapter";
import { getSession } from "@zoonk/core/users/session";
import { buttonVariants } from "@zoonk/ui/components/button";
import { GridToolbar } from "@zoonk/ui/components/grid";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterHeader } from "./chapter-header";

/**
 * Loads the chapter identity and learner actions independently from the lesson
 * grid so a cold request can stream whichever catalog section resolves first.
 */
export async function ChapterSidebar({
  params,
  searchParams,
}: Pick<
  PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">,
  "params" | "searchParams"
>) {
  const { brandSlug, chapterSlug, courseSlug } = await params;
  const search = await searchParams;
  const view = search.view === "curriculum" ? "curriculum" : "teaching";

  const [chapter, session] = await Promise.all([
    getChapter({ brandSlug, chapterSlug, courseSlug }),
    getSession(),
  ]);

  if (!chapter) {
    notFound();
  }

  const lessons = await listChapterLessons({ chapterId: chapter.id, view });

  const shouldShowCreateChapterPrompt =
    (brandSlug === AI_ORG_SLUG || brandSlug === "me") &&
    chapter.generationStatus !== "completed" &&
    lessons.length === 0;

  const firstVisibleLesson = lessons[0];
  const t = await getExtracted();

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
          {view === "curriculum" && fallbackHref ? (
            <Link className={buttonVariants()} href={`${fallbackHref}?view=curriculum`}>
              {t("Start chapter")}
            </Link>
          ) : (
            <Suspense fallback={<ContinueLessonLinkSkeleton />}>
              <ContinueLessonLink chapterId={chapter.id} fallbackHref={fallbackHref} />
            </Suspense>
          )}
          <Suspense fallback={null}>
            <CatalogActiveShortcutLink
              items={lessons}
              kind="lesson"
              scope={{ chapterId: chapter.id }}
            />
          </Suspense>
          {!chapter.course.userId && (
            <CatalogActions
              defaultEmail={session?.user.email}
              feedbackTarget={{ chapterSlug, courseSlug, kind: "chapter" }}
            />
          )}
        </GridToolbar>
      )}
    </>
  );
}
