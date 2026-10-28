import {
  AdminEditFormSkeleton,
  AdminEditFormSkeletonActions,
  AdminEditFormSkeletonField,
} from "@/components/admin-edit-form";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getCourse } from "@/data/courses/get-course";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CourseCurriculum } from "./course-curriculum";
import { CourseForm } from "./course-form";

export const metadata: Metadata = { title: "Edit Course" };

function CourseBreadcrumb() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/courses">Courses</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Edit</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default function CourseEditPage({ params }: PageProps<"/courses/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <CourseBreadcrumb />
          <ContainerTitle>Edit course</ContainerTitle>
          <ContainerDescription>
            Update the learner-facing title and URL slug, and review the curriculum.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="gap-8">
        <Suspense fallback={<CourseFormSkeleton />}>
          <CourseFormContent params={params} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton />}>
          <CourseCurriculumContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

async function CourseFormContent({ params }: Pick<PageProps<"/courses/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const course = await getCourse(id);

  if (!course) {
    notFound();
  }

  return <CourseForm course={{ id: course.id, slug: course.slug, title: course.title }} />;
}

async function CourseCurriculumContent({ params }: Pick<PageProps<"/courses/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  return <CourseCurriculum courseId={id} />;
}

function CourseFormSkeleton() {
  return (
    <AdminEditFormSkeleton>
      <AdminEditFormSkeletonField />
      <AdminEditFormSkeletonField />
      <AdminEditFormSkeletonActions />
    </AdminEditFormSkeleton>
  );
}
