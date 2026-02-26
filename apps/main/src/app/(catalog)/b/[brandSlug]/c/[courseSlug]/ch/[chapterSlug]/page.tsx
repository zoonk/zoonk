"use cache";

import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogContainer, CatalogToolbar } from "@/components/catalog/catalog-list";
import { ContinueActivityLink } from "@/components/catalog/continue-activity-link";
import { ProgressPreloader } from "@/components/catalog/progress-preloader";
import { getChapter } from "@/data/chapters/get-chapter";
import { listChapterLessons } from "@/data/lessons/list-chapter-lessons";
import { cacheTagChapter } from "@zoonk/utils/cache";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { cacheTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChapterHeader } from "./chapter-header";
import { LessonList } from "./lesson-list";

export async function generateStaticParams() {
  return [
    {
      brandSlug: AI_ORG_SLUG,
      chapterSlug: "sample",
      courseSlug: "sample",
      locale: "en",
    },
  ];
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">): Promise<Metadata> {
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
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]">) {
  const { brandSlug, chapterSlug, courseSlug, locale } = await params;
  setRequestLocale(locale);

  const chapter = await getChapter({ brandSlug, chapterSlug, courseSlug });

  cacheTag(cacheTagChapter({ chapterSlug }));

  if (!chapter) {
    notFound();
  }

  const lessons = await listChapterLessons({ chapterId: chapter.id });

  if (lessons.length === 0) {
    redirect(`/generate/ch/${chapter.id}`);
  }

  return (
    <main className="flex flex-1 flex-col">
      <ProgressPreloader chapterId={chapter.id} />
      <ChapterHeader brandSlug={brandSlug} chapter={chapter} courseSlug={courseSlug} />

      <CatalogContainer>
        <CatalogToolbar>
          <ContinueActivityLink
            chapterId={chapter.id}
            fallbackHref={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessons[0]?.slug}`}
          />
          <CatalogActions contentId={`${courseSlug}/${chapterSlug}`} kind="chapter" />
        </CatalogToolbar>

        <Suspense>
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
