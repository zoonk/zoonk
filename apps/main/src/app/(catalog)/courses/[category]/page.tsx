import { LIST_COURSES_LIMIT, listCourses } from "@/data/courses/list-courses";
import { getCategoryHeader, getCategoryMeta } from "@/lib/categories/category";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type CourseCategory, isValidCategory } from "@zoonk/utils/categories";
import { type Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CourseListClient } from "../course-list-client";
import { CourseListSkeleton } from "../course-list-skeleton";

export async function generateMetadata({
  params,
}: PageProps<"/courses/[category]">): Promise<Metadata> {
  const { category } = await params;

  if (!isValidCategory(category)) {
    return {};
  }

  return getCategoryMeta({ category });
}

async function CategoryCourseListContent({ category }: { category: CourseCategory }) {
  const locale = await getLocale();
  const courses = await listCourses({ category, language: locale });

  return (
    <CourseListClient
      category={category}
      initialCourses={courses}
      language={locale}
      limit={LIST_COURSES_LIMIT}
    />
  );
}

export default async function CategoryCourses({ params }: PageProps<"/courses/[category]">) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const header = await getCategoryHeader(category);

  return (
    <Container variant="list">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{header.title}</ContainerTitle>
          <ContainerDescription>{header.description}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <Suspense fallback={<CourseListSkeleton />}>
        <CategoryCourseListContent category={category} />
      </Suspense>
    </Container>
  );
}
