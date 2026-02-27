import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { UserCourseList, UserCourseListSkeleton } from "./user-course-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "View all the courses you started on Zoonk. Continue where you left off and track your progress across interactive lessons and activities.",
    ),
    title: t("My Courses"),
  };
}

export default async function MyCourses() {
  const t = await getExtracted();

  return (
    <Container variant="list">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("My Courses")}</ContainerTitle>
          <ContainerDescription>{t("Continue where you left off")}</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <Suspense fallback={<UserCourseListSkeleton />}>
        <UserCourseList />
      </Suspense>
    </Container>
  );
}
