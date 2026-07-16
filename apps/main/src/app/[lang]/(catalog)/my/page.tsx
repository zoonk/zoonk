import { Link } from "@/i18n/navigation";
import { getSession } from "@zoonk/core/users/session/get";
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

export default async function MyCourses() {
  const sessionPromise = getSession();
  const t = await getExtracted();
  const session = await sessionPromise;

  if (!session) {
    return (
      <Container className="min-h-0 flex-1 px-4" variant="centered">
        <Empty className="p-0">
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
      </Container>
    );
  }

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
