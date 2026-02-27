import { LIST_COURSES_LIMIT, listCourses } from "@/data/courses/list-courses";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { CourseListClient } from "./course-list-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "Explore all Zoonk courses to learn anything using AI. Find interactive lessons, challenges, and activities to learn subjects like science, math, technology, and more.",
    ),
    title: t("Online Courses using AI"),
  };
}

export default async function Courses() {
  const locale = await getLocale();
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
