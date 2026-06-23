import { AdminSearch } from "@/components/admin-search";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import {
  CourseStartRequestList,
  CourseStartRequestListSkeleton,
} from "./course-start-request-list";

export const metadata: Metadata = { title: "Course Start Requests" };

/**
 * Shows the durable routing decisions created by course-start entry points.
 * Admins can see raw prompts, assigned scope, canonical title, and generation
 * state without relying on the removed course-suggestion tables.
 */
export default function CourseStartRequestsPage({
  searchParams,
}: PageProps<"/course-start-requests">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Course Start Requests</ContainerTitle>
          <ContainerDescription>
            See submitted prompts, routed scopes, canonical titles, and generation status.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<div className="h-10" />}>
          <AdminSearch placeholder="Search by prompt, title, scope, or course..." />
        </Suspense>

        <Suspense fallback={<CourseStartRequestListSkeleton />}>
          <CourseStartRequestList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
