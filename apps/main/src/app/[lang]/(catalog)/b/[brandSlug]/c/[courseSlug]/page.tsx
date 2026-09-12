import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { getContentLocale } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CourseContent, CourseContentSkeleton } from "./course-content";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { brandSlug, courseSlug, lang: locale } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

  if (!course) {
    return {};
  }

  if (course.userId) {
    return { robots: { follow: false, index: false }, title: course.title };
  }

  const contentLocale = getContentLocale(course.language);
  const t = await getExtracted({ locale: contentLocale ?? locale });

  return {
    alternates: {
      canonical: getLocalizedUrl({
        href: `/b/${brandSlug}/c/${courseSlug}`,
        language: course.language,
      }),
    },
    description: t(
      "Learn {course} online with practical examples and everyday language. {description}",
      { course: course.title, description: course.description ?? "" },
    ),
    robots: { follow: true, index: contentLocale === locale },
    title: t("Learn {course}", { course: course.title }),
  };
}

export default function CoursePage(props: PageProps<"/[lang]/b/[brandSlug]/c/[courseSlug]">) {
  return (
    <Suspense fallback={<CourseContentSkeleton />}>
      <CourseContent {...props} />
    </Suspense>
  );
}
