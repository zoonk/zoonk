import { getOrganizationBySlug } from "@zoonk/core/organizations";
import {
  Container,
  ContainerAction,
  ContainerActions,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cacheTagOrg } from "@zoonk/utils/cache";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { getExtracted, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { CourseList, CourseListSkeleton } from "./course-list";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/[orgSlug]">): Promise<Metadata> {
  const { orgSlug } = await params;
  const { data: org } = await getOrganizationBySlug(orgSlug);

  if (!org) {
    return {};
  }

  return { title: org.name };
}

async function HomeContainerHeader({
  params,
}: {
  params: PageProps<"/[locale]/[orgSlug]">["params"];
}) {
  "use cache";

  const { locale, orgSlug } = await params;
  setRequestLocale(locale);

  cacheLife("max");
  cacheTag(locale, cacheTagOrg({ orgSlug }));

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

export default async function OrgHomePage({
  params,
}: PageProps<"/[locale]/[orgSlug]">) {
  return (
    <Container variant="list">
      <HomeContainerHeader params={params} />

      <Suspense fallback={<CourseListSkeleton />}>
        <CourseList params={params} />
      </Suspense>
    </Container>
  );
}
