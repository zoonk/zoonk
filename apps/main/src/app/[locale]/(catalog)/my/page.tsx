import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { UserCourseList, UserCourseListSkeleton } from "./user-course-list";
import type { Metadata } from "next";

export async function generateMetadata({ params }: PageProps<"/[locale]/my">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getExtracted({ locale });

  return {
    description: t(
      "View all the courses you started on Zoonk. Continue where you left off and track your progress across interactive lessons and activities.",
    ),
    title: t("My Courses"),
  };
}

export default async function MyCourses({ params }: PageProps<"/[locale]/my">) {
  const { locale } = await params;
  setRequestLocale(locale);

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
