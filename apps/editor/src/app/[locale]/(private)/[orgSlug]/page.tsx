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
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
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

export default async function OrgHomePage({
  params,
}: PageProps<"/[locale]/[orgSlug]">) {
  "use cache: private";

  const { orgSlug } = await params;
  const t = await getExtracted();

  return (
    <Container variant="list">
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
            render={<Link href={`/${orgSlug}/new-course`} />}
          >
            {t("Create course")}
          </ContainerAction>
        </ContainerActions>
      </ContainerHeader>

      <Suspense fallback={<CourseListSkeleton />}>
        <CourseList orgSlug={orgSlug} />
      </Suspense>
    </Container>
  );
}
