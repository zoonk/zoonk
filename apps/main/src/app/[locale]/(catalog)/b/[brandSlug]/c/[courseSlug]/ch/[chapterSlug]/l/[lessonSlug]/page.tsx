"use cache";

import { listLessonActivities } from "@/data/activities/list-lesson-activities";
import { getLesson } from "@/data/lessons/get-lesson";
import { redirect } from "@/i18n/navigation";
import { getActivityKinds } from "@/lib/activities";
import { cacheTagLesson } from "@zoonk/utils/cache";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { ActivityList } from "./activity-list";
import { LessonHeader } from "./lesson-header";

export async function generateStaticParams() {
  return [
    {
      brandSlug: AI_ORG_SLUG,
      chapterSlug: "sample",
      courseSlug: "sample",
      lessonSlug: "sample",
      locale: "en",
    },
  ];
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">): Promise<Metadata> {
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
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug, locale } = await params;
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

  const activities = await listLessonActivities({ lessonId: lesson.id });

  if (activities.length === 0) {
    redirect({ href: `/generate/l/${lesson.id}`, locale });
  }

  const activityKinds = await getActivityKinds({ locale });
  const kindMeta = new Map(activityKinds.map((kind) => [kind.key, kind]));
  const baseHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`;

  return (
    <main className="flex flex-1 flex-col">
      <LessonHeader
        brandSlug={brandSlug}
        chapterSlug={chapterSlug}
        courseSlug={courseSlug}
        lesson={lesson}
      />

      <div className="mx-auto w-full px-4 py-6 lg:max-w-xl">
        <ActivityList activities={activities} baseHref={baseHref} kindMeta={kindMeta} />
      </div>
    </main>
  );
}
