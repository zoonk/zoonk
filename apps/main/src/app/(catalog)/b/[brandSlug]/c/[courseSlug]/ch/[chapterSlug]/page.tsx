import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogDetailLayout } from "@/components/catalog/catalog-detail-layout";
import { CatalogGridSkeleton } from "@/components/catalog/catalog-skeletons";
import {
  ContinueLessonLink,
  ContinueLessonLinkSkeleton,
} from "@/components/catalog/continue-lesson-link";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { getNextChapterInCourse } from "@zoonk/core/lessons/next-chapter-in-course";
import { getSession } from "@zoonk/core/users/session/get";
import { Grid, GridToolbar } from "@zoonk/ui/components/grid";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChapterHeader } from "./chapter-header";
import { LessonList } from "./lesson-list";

export async function generateMetadata({
  params,
}: PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const chapter = await getChapter({ brandSlug, chapterSlug, courseSlug });

  if (!chapter) {
    return {};
  }

  return { description: chapter.description, title: chapter.title };
}

export default async function ChapterPage({
  params,
}: PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">) {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const [chapter, session] = await Promise.all([
    getChapter({ brandSlug, chapterSlug, courseSlug }),
    getSession(),
  ]);

  if (!chapter) {
    notFound();
  }

  const [lessons, nextChapter] = await Promise.all([
    listChapterLessons({ chapterId: chapter.id }),
    getNextChapterInCourse({ chapterPosition: chapter.position, courseId: chapter.courseId }),
  ]);

  if (brandSlug === AI_ORG_SLUG && lessons.length === 0) {
    redirect(`/generate/ch/${chapter.id}`);
  }

  const completedHref = nextChapter
    ? (`/b/${nextChapter.brandSlug}/c/${nextChapter.courseSlug}/ch/${nextChapter.chapterSlug}` as const)
    : undefined;

  const fallbackHref = lessons[0]
    ? (`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessons[0].slug}` as const)
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
          <GridToolbar>
            <Suspense fallback={<ContinueLessonLinkSkeleton />}>
              <ContinueLessonLink
                chapterId={chapter.id}
                completedHref={completedHref}
                fallbackHref={fallbackHref}
              />
            </Suspense>
            <CatalogActions
              contentId={`${courseSlug}/${chapterSlug}`}
              defaultEmail={session?.user.email}
              kind="chapter"
            />
          </GridToolbar>
        </>
      }
    >
      <Grid variant="pane">
        <Suspense
          fallback={<CatalogGridSkeleton count={lessons.length} groupVariant="pane" search />}
        >
          <LessonList
            brandSlug={brandSlug}
            chapterId={chapter.id}
            chapterSlug={chapterSlug}
            courseSlug={courseSlug}
            lessons={lessons}
          />
        </Suspense>
      </Grid>
    </CatalogDetailLayout>
  );
}
