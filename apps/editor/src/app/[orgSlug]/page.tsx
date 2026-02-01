import { getOrganization } from "@zoonk/core/orgs/get";
import { Container, ContainerHeader } from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { CourseListSkeleton } from "@zoonk/ui/patterns/courses/list";
import { type Metadata } from "next";
import { Suspense } from "react";
import { HomeContainerHeader } from "./home-container-header";
import { ListCourses } from "./list-courses";

export async function generateMetadata({ params }: PageProps<"/[orgSlug]">): Promise<Metadata> {
  const { orgSlug } = await params;
  const { data: org } = await getOrganization(orgSlug);

  if (!org) {
    return {};
  }

  return { title: org.name };
}

function HomeContainerHeaderSkeleton() {
  return (
    <ContainerHeader>
      <Skeleton className="h-7 w-32" />
    </ContainerHeader>
  );
}

export default function OrgHomePage({ params }: PageProps<"/[orgSlug]">) {
  return (
    <Container variant="list">
      <Suspense fallback={<HomeContainerHeaderSkeleton />}>
        <HomeContainerHeader params={params} />
      </Suspense>

      <Suspense fallback={<CourseListSkeleton />}>
        <ListCourses params={params} />
      </Suspense>
    </Container>
  );
}
