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
import { CourseList } from "./course-list";

export const metadata: Metadata = { title: "Courses" };

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
        <Suspense fallback={<div className="h-10" />}>
          <AdminSearch placeholder="Search by title..." />
        </Suspense>

        <Suspense>
          <CourseList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
