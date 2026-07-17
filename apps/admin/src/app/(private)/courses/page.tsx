import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
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
import { CourseList, CourseListSkeleton } from "./course-list";

export const metadata: Metadata = { title: "Courses" };
export const prefetch = "allow-runtime";

export default function CoursesPage({ searchParams }: PageProps<"/courses">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Courses</ContainerTitle>
          <ContainerDescription>Manage all courses in the system.</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<AdminSearchSkeleton />}>
          <AdminSearch placeholder="Search by title..." />
        </Suspense>

        <Suspense fallback={<CourseListSkeleton />}>
          <CourseList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
