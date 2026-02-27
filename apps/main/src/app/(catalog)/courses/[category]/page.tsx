import { LIST_COURSES_LIMIT, listCourses } from "@/data/courses/list-courses";
import { getCategoryHeader, getCategoryMeta } from "@/lib/categories/category-server";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { isValidCategory } from "@zoonk/utils/categories";
import { type Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CourseListClient } from "../course-list-client";

export async function generateMetadata({
  params,
}: PageProps<"/courses/[category]">): Promise<Metadata> {
  const { category } = await params;

  if (!isValidCategory(category)) {
    return {};
  }

  return getCategoryMeta({ category });
}

export default async function CategoryCourses({ params }: PageProps<"/courses/[category]">) {
  const locale = await getLocale();
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

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
