import { listCourses } from "@zoonk/core/courses/list";
import { getOrganization } from "@zoonk/core/organizations/get";
import {
  Container,
  ContainerAction,
  ContainerActions,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CourseList, CourseListSkeleton } from "./course-list";

export async function generateMetadata({
  params,
}: PageProps<"/[orgSlug]">): Promise<Metadata> {
  const { orgSlug } = await params;
  const { data: org } = await getOrganization(orgSlug);

  if (!org) {
    return {};
  }

  return { title: org.name };
}

async function HomeContainerHeader({
  params,
}: {
  params: PageProps<"/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;

  const t = await getExtracted();

  return (
    <ContainerHeader>
      <ContainerHeaderGroup>
        <ContainerTitle>{t("Courses")}</ContainerTitle>
        <ContainerDescription>
          {t("Select a course to edit its content")}
        </ContainerDescription>
      </ContainerHeaderGroup>

      <ContainerActions>
        <ContainerAction
          icon={PlusIcon}
          render={<Link href={`/${orgSlug}/new-course`} prefetch={true} />}
        >
          {t("Create course")}
        </ContainerAction>
      </ContainerActions>
    </ContainerHeader>
  );
}

async function ListCourses({
  params,
}: {
  params: PageProps<"/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;
  const { data: courses } = await listCourses({ orgSlug, visibility: "all" });

  return <CourseList courses={courses} orgSlug={orgSlug} />;
}

export default async function OrgHomePage({ params }: PageProps<"/[orgSlug]">) {
  return (
    <Container variant="list">
      <HomeContainerHeader params={params} />

      <Suspense fallback={<CourseListSkeleton />}>
        <ListCourses params={params} />
      </Suspense>
    </Container>
  );
}
