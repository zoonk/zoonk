import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogContainer, CatalogToolbar } from "@/components/catalog/catalog-list";
import { CatalogListSkeleton } from "@/components/catalog/catalog-skeletons";
import {
  ContinueActivityLink,
  ContinueActivityLinkSkeleton,
} from "@/components/catalog/continue-activity-link";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { getSession } from "@zoonk/core/users/session/get";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ChapterList } from "./chapter-list";
import { CourseHeader } from "./course-header";

export async function generateMetadata({
  params,
}: PageProps<"/b/[brandSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { brandSlug, courseSlug } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    return {};
  }

  const t = await getExtracted({ locale: course.language });

  return {
    description: t(
      "Online and interactive course on {course}. Learn everything about {course} using real-life examples and everyday language. {description}",
      {
        course: course.title,
        description: course.description ?? "",
      },
    ),
    title: t("Learn {course}", { course: course.title }),
  };
}

export default async function CoursePage({ params }: PageProps<"/b/[brandSlug]/c/[courseSlug]">) {
  const { brandSlug, courseSlug } = await params;

  const [course, session] = await Promise.all([getCourse({ brandSlug, courseSlug }), getSession()]);

  if (!course) {
    notFound();
  }

  const chapters = await listCourseChapters({ courseId: course.id });

  if (brandSlug === AI_ORG_SLUG && chapters.length === 0) {
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
          <CatalogActions contentId={courseSlug} defaultEmail={session?.user.email} kind="course" />
        </CatalogToolbar>

        <Suspense fallback={<CatalogListSkeleton count={chapters.length} search />}>
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
