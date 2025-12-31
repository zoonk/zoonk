"use cache";

import { Badge } from "@zoonk/ui/components/badge";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { NotebookPenIcon } from "lucide-react";
import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getExtracted, setRequestLocale } from "next-intl/server";
import {
  CourseHeader,
  CourseHeaderContent,
  CourseHeaderDescription,
  CourseHeaderIcon,
  CourseHeaderImage,
  CourseHeaderMeta,
  CourseHeaderSource,
  CourseHeaderTitle,
} from "@/components/course/course-header";
import { getCourse } from "@/data/courses/get-course";
import { Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/categories";

export async function generateStaticParams() {
  const { prisma } = await import("@zoonk/db");

  const course = await prisma.course.findFirst({
    select: { language: true, slug: true },
    where: {
      isPublished: true,
      organization: { kind: "brand", slug: "ai" },
    },
  });

  if (!course) {
    return [];
  }

  return [
    {
      brandSlug: "ai",
      courseSlug: course.slug,
      locale: course.language,
    },
  ];
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { brandSlug, courseSlug, locale } = await params;
  const t = await getExtracted({ locale });

  const course = await getCourse({
    brandSlug,
    courseSlug,
    language: locale,
  });

  if (!course) {
    return {
      description: t(
        "Learn with interactive lessons and activities. Explore this course and start your learning journey.",
      ),
      title: t("Course not found"),
    };
  }

  return {
    description: course.description,
    title: course.title,
  };
}

export default async function CoursePage({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]">) {
  const { brandSlug, courseSlug, locale } = await params;

  setRequestLocale(locale);
  cacheTag(cacheTagCourse({ courseSlug }));

  const course = await getCourse({
    brandSlug,
    courseSlug,
    language: locale,
  });

  if (!course) {
    notFound();
  }

  const categoryLabels = await getCategories({ locale });
  const courseCategoryKeys = course.categories.map((c) => c.category);
  const displayCategories = categoryLabels.filter((cat) =>
    courseCategoryKeys.includes(cat.key),
  );

  return (
    <main className="flex flex-1 flex-col py-4 lg:py-8">
      <CourseHeader>
        {course.imageUrl ? (
          <CourseHeaderImage>
            <Image
              alt={course.title}
              className="size-full object-cover"
              fill
              sizes="(max-width: 768px) 96px, 128px"
              src={course.imageUrl}
            />
          </CourseHeaderImage>
        ) : (
          <CourseHeaderIcon>
            <NotebookPenIcon
              aria-hidden="true"
              className="size-8 text-muted-foreground/80"
            />
          </CourseHeaderIcon>
        )}

        <CourseHeaderContent>
          <CourseHeaderSource>{course.organization.name}</CourseHeaderSource>
          <CourseHeaderTitle>{course.title}</CourseHeaderTitle>
          <CourseHeaderDescription>
            {course.description}
          </CourseHeaderDescription>

          {displayCategories.length > 0 && (
            <CourseHeaderMeta>
              {displayCategories.map((cat) => (
                <Badge
                  key={cat.key}
                  render={<Link href={`/courses/${cat.key}`} />}
                  variant="outline"
                >
                  {cat.label}
                </Badge>
              ))}
            </CourseHeaderMeta>
          )}
        </CourseHeaderContent>
      </CourseHeader>
    </main>
  );
}
