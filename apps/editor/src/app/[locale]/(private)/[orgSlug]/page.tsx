import { listOrganizationCourses } from "@zoonk/core/courses";
import { getOrganizationBySlug } from "@zoonk/core/organizations";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cacheTagOrg, cacheTagOrgCourses } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { CourseList, CourseListSkeleton } from "./course-list";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[orgSlug]">): Promise<Metadata> {
  "use cache: remote";

  const { locale, orgSlug } = await params;
  const { data: org } = await getOrganizationBySlug(orgSlug);

  cacheLife("max");
  cacheTag(locale, cacheTagOrg({ orgSlug }));

  if (!org) {
    return {};
  }

  return { title: org.name };
}

export default async function OrgHomePage({
  params,
}: PageProps<"/[locale]/[orgSlug]">) {
  "use cache: remote";

  const { locale, orgSlug } = await params;
  const { data: org } = await getOrganizationBySlug(orgSlug);

  if (!org) {
    notFound();
  }

  cacheLife("max");
  cacheTag(locale, cacheTagOrg({ orgSlug }), cacheTagOrgCourses({ orgSlug }));

  setRequestLocale(locale);
  const t = await getExtracted();

  const { data: orgCourses } = await listOrganizationCourses(org.id);

  return (
    <Container variant="list">
      <ContainerHeader>
        <ContainerTitle>{t("Courses")}</ContainerTitle>
        <ContainerDescription>
          {t("Select a course to edit its content")}
        </ContainerDescription>
      </ContainerHeader>

      <Suspense fallback={<CourseListSkeleton />}>
        <CourseList courses={orgCourses} orgSlug={org.slug} />
      </Suspense>
    </Container>
  );
}
