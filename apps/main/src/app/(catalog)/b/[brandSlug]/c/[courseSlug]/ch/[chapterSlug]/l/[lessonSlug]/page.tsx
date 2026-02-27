import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogContainer, CatalogToolbar } from "@/components/catalog/catalog-list";
import { CatalogListSkeleton } from "@/components/catalog/catalog-skeletons";
import {
  ContinueActivityLink,
  ContinueActivityLinkSkeleton,
} from "@/components/catalog/continue-activity-link";
import { listLessonActivities } from "@/data/activities/list-lesson-activities";
import { getLesson } from "@/data/lessons/get-lesson";
import { getSession } from "@zoonk/core/users/session/get";
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

  const [lesson, session] = await Promise.all([
    getLesson({ brandSlug, chapterSlug, courseSlug, lessonSlug }),
    getSession(),
  ]);

  if (!lesson) {
    notFound();
  }

  const activities = await listLessonActivities({ lessonId: lesson.id });

  if (activities.length === 0) {
    redirect(`/generate/l/${lesson.id}`);
  }

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
          <CatalogActions
            contentId={`${courseSlug}/${chapterSlug}/${lessonSlug}`}
            defaultEmail={session?.user.email}
            kind="lesson"
          />
        </CatalogToolbar>

        <Suspense fallback={<CatalogListSkeleton count={activities.length} variant="indicator" />}>
          <ActivityList
            activities={activities}
            brandSlug={brandSlug}
            chapterSlug={chapterSlug}
            courseSlug={courseSlug}
            lessonId={lesson.id}
            lessonSlug={lessonSlug}
          />
        </Suspense>
      </CatalogContainer>
    </main>
  );
}
