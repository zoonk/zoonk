import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import {
  AdminEditFormSkeleton,
  AdminEditFormSkeletonActions,
  AdminEditFormSkeletonField,
} from "@/components/admin-edit-form";
import { AdminSection, AdminSectionSkeleton } from "@/components/admin-section";
import { getCourse } from "@/data/courses/get-course";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CourseCurriculum } from "./course-curriculum";
import { CourseForm } from "./course-form";

export const metadata: Metadata = { title: "Course" };

const COURSE_PARENTS = [{ href: "/courses", label: "Courses" }];

export default function CoursePage({ params }: PageProps<"/courses/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<CourseSkeleton />}>
        <CourseContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function CourseContent({ params }: Pick<PageProps<"/courses/[id]">, "params">) {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const course = await getCourse(id);

  if (!course) {
    notFound();
  }

  return (
    <>
      <AdminDetailHeader
        facts={[
          course.targetLanguage
            ? `${course.language.toUpperCase()} → ${course.targetLanguage.toUpperCase()}`
            : course.language.toUpperCase(),
          course.isPublished ? "Published" : "Not published",
          course.visibility === "private" && "Private",
          `${course.userCount.toLocaleString()} ${course.userCount === 1 ? "learner" : "learners"}`,
        ]}
        parents={COURSE_PARENTS}
        title={course.title}
      />

      <AdminDetailBody>
        <AdminSection title="Title and slug">
          <CourseForm course={{ id: course.id, slug: course.slug, title: course.title }} />
        </AdminSection>

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <CourseCurriculum courseId={course.id} />
        </Suspense>
      </AdminDetailBody>
    </>
  );
}

function CourseSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton parents={COURSE_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton>
          <AdminEditFormSkeleton>
            <div className="flex flex-col gap-7">
              <AdminEditFormSkeletonField />
              <AdminEditFormSkeletonField descriptionClassName="h-[2lh] sm:h-lh" />
            </div>
            <AdminEditFormSkeletonActions />
          </AdminEditFormSkeleton>
        </AdminSectionSkeleton>
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
