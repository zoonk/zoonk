"use cache";

import { prisma } from "@zoonk/db";
import { cacheTagCourse } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCourse } from "@/data/courses/get-course";
import { CourseHeader } from "./course-header";

export async function generateStaticParams() {
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
    { brandSlug: "ai", courseSlug: course.slug, locale: course.language },
  ];
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { brandSlug, courseSlug, locale } = await params;
  const course = await getCourse({ brandSlug, courseSlug, language: locale });

  if (!course) {
    return {};
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
  const course = await getCourse({ brandSlug, courseSlug, language: locale });

  setRequestLocale(locale);
  cacheTag(cacheTagCourse({ courseSlug }));

  if (!course) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col">
      <CourseHeader brandSlug={brandSlug} course={course} />
    </main>
  );
}
