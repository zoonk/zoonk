"use cache";

import { cacheTagLesson } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLesson } from "@/data/lessons/get-lesson";
import { getSampleLessonParams } from "@/data/static-params";
import { LessonHeader } from "./lesson-header";

export const generateStaticParams = getSampleLessonParams;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/c/[chapterSlug]/l/[lessonSlug]">): Promise<Metadata> {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;
  const lesson = await getLesson({
    brandSlug,
    chapterSlug,
    courseSlug,
    lessonSlug,
  });

  if (!lesson) {
    return {};
  }

  return {
    description: lesson.description,
    title: lesson.title,
  };
}

export default async function LessonPage({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/c/[chapterSlug]/l/[lessonSlug]">) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug, locale } =
    await params;
  setRequestLocale(locale);

  const lesson = await getLesson({
    brandSlug,
    chapterSlug,
    courseSlug,
    lessonSlug,
  });

  cacheTag(cacheTagLesson({ lessonSlug }));

  if (!lesson) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col">
      <LessonHeader
        brandSlug={brandSlug}
        courseSlug={courseSlug}
        lesson={lesson}
      />
    </main>
  );
}
