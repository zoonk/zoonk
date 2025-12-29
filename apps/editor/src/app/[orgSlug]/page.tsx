import { getOrganization } from "@zoonk/core/orgs/get";
import { Container } from "@zoonk/ui/components/container";
import { CourseListSkeleton } from "@zoonk/ui/patterns/courses/list";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeContainerHeader } from "./home-container-header";
import { ListCourses } from "./list-courses";

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
