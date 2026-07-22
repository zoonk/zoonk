import {
  AdminEditFormSkeleton,
  AdminEditFormSkeletonActions,
  AdminEditFormSkeletonField,
} from "@/components/admin-edit-form";
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
import { CourseForm } from "./course-form";

export const metadata: Metadata = { title: "Edit Course" };
export const prefetch = "allow-runtime";

/**
 * The course editor stays anchored to the catalog list through the same compact
 * breadcrumb pattern used by other admin detail pages.
 */
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

/**
 * The static course edit shell streams the private record into a focused title
 * and slug form without delaying navigation chrome.
 */
export default function CourseEditPage({ params }: PageProps<"/courses/[id]">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <CourseBreadcrumb />
          <ContainerTitle>Edit course</ContainerTitle>
          <ContainerDescription>
            Update the learner-facing title and course URL slug.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<CourseFormSkeleton />}>
          <CourseFormContent params={params} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}

/**
 * Only valid, existing course identifiers reach the form, keeping malformed
 * URLs away from Prisma's UUID boundary.
 */
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

/**
 * Title and slug placeholders keep the form's final dimensions stable until
 * the course record resolves.
 */
function CourseFormSkeleton() {
  return (
    <AdminEditFormSkeleton>
      <AdminEditFormSkeletonField />
      <AdminEditFormSkeletonField />
      <AdminEditFormSkeletonActions />
    </AdminEditFormSkeleton>
  );
}
