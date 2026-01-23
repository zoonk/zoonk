"use cache";

import { LIST_COURSES_LIMIT, listCourses } from "@/data/courses/list-courses";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cacheTagCoursesList } from "@zoonk/utils/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { cacheTag } from "next/cache";
import { CourseListClient } from "./course-list-client";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/courses">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "Explore all Zoonk courses to learn anything using AI. Find interactive lessons, challenges, and activities to learn subjects like science, math, technology, and more.",
    ),
    title: t("Online Courses using AI"),
  };
}

export default async function Courses({ params }: PageProps<"/[locale]/courses">) {
  const { locale } = await params;
  setRequestLocale(locale);
  cacheTag(cacheTagCoursesList({ language: locale }));

  const t = await getExtracted();
  const courses = await listCourses({ language: locale });

  return (
    <Container variant="list">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Explore courses")}</ContainerTitle>
          <ContainerDescription>{t("Start learning something new today")}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <CourseListClient initialCourses={courses} language={locale} limit={LIST_COURSES_LIMIT} />
    </Container>
  );
}
