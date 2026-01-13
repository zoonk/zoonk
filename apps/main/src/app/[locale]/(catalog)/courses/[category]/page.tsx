"use cache";

import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cacheTagCoursesListByCategory } from "@zoonk/utils/cache";
import { COURSE_CATEGORIES, isValidCategory } from "@zoonk/utils/categories";
import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LIST_COURSES_LIMIT, listCourses } from "@/data/courses/list-courses";
import {
  getCategoryHeader,
  getCategoryMeta,
} from "@/lib/categories/category-server";
import { CourseListClient } from "../course-list-client";

export async function generateStaticParams() {
  return COURSE_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/courses/[category]">): Promise<Metadata> {
  const { category, locale } = await params;

  if (!isValidCategory(category)) {
    return {};
  }

  return getCategoryMeta({ category, locale });
}

export default async function CategoryCourses({
  params,
}: PageProps<"/[locale]/courses/[category]">) {
  const { category, locale } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  setRequestLocale(locale);
  cacheTag(cacheTagCoursesListByCategory({ category, language: locale }));

  const header = await getCategoryHeader(category);
  const courses = await listCourses({ category, language: locale });

  return (
    <Container variant="list">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{header.title}</ContainerTitle>
          <ContainerDescription>{header.description}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <CourseListClient
        category={category}
        initialCourses={courses}
        language={locale}
        limit={LIST_COURSES_LIMIT}
      />
    </Container>
  );
}
