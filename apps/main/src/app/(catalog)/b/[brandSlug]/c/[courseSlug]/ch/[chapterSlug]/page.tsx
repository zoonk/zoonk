import { CatalogActions } from "@/components/catalog/catalog-actions";
import {
  CatalogContainer,
  CatalogListSkeleton,
  CatalogToolbar,
} from "@/components/catalog/catalog-list";
import {
  ContinueActivityLink,
  ContinueActivityLinkSkeleton,
} from "@/components/catalog/continue-activity-link";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChapterHeader } from "./chapter-header";
import { LessonList } from "./lesson-list";

export async function generateMetadata({
  params,
}: PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const chapter = await getChapter({
    brandSlug,
    chapterSlug,
    courseSlug,
  });

  if (!chapter) {
    return {};
  }

  return {
    description: chapter.description,
    title: chapter.title,
  };
}

export default async function ChapterPage({
  params,
}: PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">) {
  const { brandSlug, chapterSlug, courseSlug } = await params;

  const chapter = await getChapter({ brandSlug, chapterSlug, courseSlug });

  if (!chapter) {
    notFound();
  }

  const lessons = await listChapterLessons({ chapterId: chapter.id });

  if (lessons.length === 0) {
    redirect(`/generate/ch/${chapter.id}`);
  }

  return (
    <main className="flex flex-1 flex-col">
      <ChapterHeader brandSlug={brandSlug} chapter={chapter} courseSlug={courseSlug} />

      <CatalogContainer>
        <CatalogToolbar>
          <Suspense fallback={<ContinueActivityLinkSkeleton />}>
            <ContinueActivityLink
              chapterId={chapter.id}
              fallbackHref={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessons[0]?.slug}`}
            />
          </Suspense>
          <CatalogActions contentId={`${courseSlug}/${chapterSlug}`} kind="chapter" />
        </CatalogToolbar>

        <Suspense fallback={<CatalogListSkeleton count={lessons.length} search />}>
          <LessonList
            brandSlug={brandSlug}
            chapterId={chapter.id}
            chapterSlug={chapterSlug}
            courseSlug={courseSlug}
            lessons={lessons}
          />
        </Suspense>
      </CatalogContainer>
    </main>
  );
}
