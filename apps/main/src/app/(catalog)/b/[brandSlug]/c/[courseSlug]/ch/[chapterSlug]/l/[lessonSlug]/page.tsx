import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogContainer, CatalogToolbar } from "@/components/catalog/catalog-list";
import {
  ContinueActivityLink,
  ContinueActivityLinkSkeleton,
} from "@/components/catalog/continue-activity-link";
import { listLessonActivities } from "@/data/activities/list-lesson-activities";
import { getLesson } from "@/data/lessons/get-lesson";
import { getActivityKinds } from "@/lib/activities";
import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActivityList } from "./activity-list";
import { LessonHeader } from "./lesson-header";

export async function generateMetadata({
  params,
}: PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">): Promise<Metadata> {
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
}: PageProps<"/b/[brandSlug]/c/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">) {
  const { brandSlug, chapterSlug, courseSlug, lessonSlug } = await params;

  const lesson = await getLesson({
    brandSlug,
    chapterSlug,
    courseSlug,
    lessonSlug,
  });

  if (!lesson) {
    notFound();
  }

  const activities = await listLessonActivities({ lessonId: lesson.id });

  if (activities.length === 0) {
    redirect(`/generate/l/${lesson.id}`);
  }

  const activityKinds = await getActivityKinds();
  const kindMeta = new Map(activityKinds.map((kind) => [kind.key, kind]));

  return (
    <main className="flex flex-1 flex-col">
      <LessonHeader
        brandSlug={brandSlug}
        chapterSlug={chapterSlug}
        courseSlug={courseSlug}
        lesson={lesson}
      />

      <CatalogContainer>
        <CatalogToolbar>
          <Suspense fallback={<ContinueActivityLinkSkeleton />}>
            <ContinueActivityLink
              fallbackHref={`/b/${brandSlug}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}/a/${activities[0]?.position}`}
              lessonId={lesson.id}
            />
          </Suspense>
          <CatalogActions contentId={`${courseSlug}/${chapterSlug}/${lessonSlug}`} kind="lesson" />
        </CatalogToolbar>
        <ActivityList
          activities={activities}
          brandSlug={brandSlug}
          chapterSlug={chapterSlug}
          courseSlug={courseSlug}
          kindMeta={kindMeta}
          lessonId={lesson.id}
          lessonSlug={lessonSlug}
        />
      </CatalogContainer>
    </main>
  );
}
