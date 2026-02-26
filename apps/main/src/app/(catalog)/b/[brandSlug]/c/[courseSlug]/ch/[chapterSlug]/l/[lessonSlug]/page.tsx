"use cache";

import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogContainer, CatalogToolbar } from "@/components/catalog/catalog-list";
import { ContinueActivityLink } from "@/components/catalog/continue-activity-link";
import { ProgressPreloader } from "@/components/catalog/progress-preloader";
import { listLessonActivities } from "@/data/activities/list-lesson-activities";
import { getLesson } from "@/data/lessons/get-lesson";
import { getActivityKinds } from "@/lib/activities";
import { cacheTagLesson } from "@zoonk/utils/cache";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { cacheTag } from "next/cache";
import { notFound, redirect } from "next/navigation";
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
    redirect(`/generate/l/${lesson.id}`);
  }

  const activityKinds = await getActivityKinds({ locale });
  const kindMeta = new Map(activityKinds.map((kind) => [kind.key, kind]));
  const baseHref = `/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`;

  return (
    <main className="flex flex-1 flex-col">
      <ProgressPreloader lessonId={lesson.id} />
      <LessonHeader
        brandSlug={brandSlug}
        chapterSlug={chapterSlug}
        courseSlug={courseSlug}
        lesson={lesson}
      />

      <CatalogContainer>
        <CatalogToolbar>
          <ContinueActivityLink
            fallbackHref={`${baseHref}/a/${activities[0]?.position}`}
            lessonId={lesson.id}
          />
          <CatalogActions contentId={`${courseSlug}/${chapterSlug}/${lessonSlug}`} kind="lesson" />
        </CatalogToolbar>
        <ActivityList
          activities={activities}
          baseHref={baseHref}
          kindMeta={kindMeta}
          lessonId={lesson.id}
        />
      </CatalogContainer>
    </main>
  );
}
