import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogContainer, CatalogToolbar } from "@/components/catalog/catalog-list";
import {
  ContinueActivityLink,
  ContinueActivityLinkSkeleton,
} from "@/components/catalog/continue-activity-link";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChapterList, ChapterListSkeleton } from "./chapter-list";
import { CourseHeader } from "./course-header";

export async function generateMetadata({
  params,
}: PageProps<"/b/[brandSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { brandSlug, courseSlug } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    return {};
  }

  return {
    description: course.description,
    title: course.title,
  };
}

export default async function CoursePage({ params }: PageProps<"/b/[brandSlug]/c/[courseSlug]">) {
  const { brandSlug, courseSlug } = await params;

  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    notFound();
  }

  const chapters = await listCourseChapters({ courseId: course.id });

  if (chapters.length === 0) {
    redirect(`/generate/c/${course.slug}`);
  }

  return (
    <main className="flex flex-1 flex-col">
      <CourseHeader brandSlug={brandSlug} course={course} />

      <CatalogContainer>
        <CatalogToolbar>
          <Suspense fallback={<ContinueActivityLinkSkeleton />}>
            <ContinueActivityLink
              courseId={course.id}
              fallbackHref={`/b/${brandSlug}/c/${courseSlug}/ch/${chapters[0]?.slug}`}
            />
          </Suspense>
          <CatalogActions contentId={courseSlug} kind="course" />
        </CatalogToolbar>

        <Suspense fallback={<ChapterListSkeleton count={chapters.length} />}>
          <ChapterList
            brandSlug={brandSlug}
            chapters={chapters}
            courseId={course.id}
            courseSlug={courseSlug}
          />
        </Suspense>
      </CatalogContainer>
    </main>
  );
}
