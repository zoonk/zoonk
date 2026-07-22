import { getSession } from "@/data/users/get-session";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { LogInIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { UserCourseList, UserCourseListSkeleton } from "./user-course-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return {
    description: t(
      "View all the courses you started on Zoonk. Continue where you left off and track your progress across interactive lessons.",
    ),
    title: t("My Courses"),
  };
}

/**
 * Selects the signed-in course list or the login prompt inside the page's body
 * boundary so the shared title remains part of the prerendered shell.
 */
async function MyCoursesBody() {
  const t = await getExtracted();
  const session = await getSession();

  if (!session) {
    return (
      <Empty className="min-h-[calc(100dvh-12rem)] p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LogInIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("Log in to track your courses")}</EmptyTitle>
          <EmptyDescription>
            {t("Keep your courses and progress in one place by logging in to your account.")}
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/login?next=%2Fmy"
            prefetch={false}
          >
            {t("Log in")}
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return <UserCourseList />;
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
        <MyCoursesBody />
      </Suspense>
    </Container>
  );
}
