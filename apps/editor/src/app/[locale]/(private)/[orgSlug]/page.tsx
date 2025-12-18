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
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { CourseList, CourseListSkeleton } from "./course-list";

function HomeContainerHeaderSkeleton() {
  return (
    <ContainerHeader>
      <ContainerHeaderGroup>
        <Skeleton className="h-[18px] w-20" />
        <Skeleton className="h-5 w-52" />
      </ContainerHeaderGroup>

      <ContainerActions>
        <Skeleton className="size-9 rounded-4xl sm:h-9 sm:w-28" />
      </ContainerActions>
    </ContainerHeader>
  );
}

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
          render={<Link href={`/${orgSlug}/new-course`} />}
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
      <Suspense fallback={<HomeContainerHeaderSkeleton />}>
        <HomeContainerHeader params={params} />
      </Suspense>

      <Suspense fallback={<CourseListSkeleton />}>
        <CourseList params={params} />
      </Suspense>
    </Container>
  );
}
