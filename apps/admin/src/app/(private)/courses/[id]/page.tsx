import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getCourse } from "@/data/courses/get-course";
import { formatCount } from "@/lib/format";
import { languageName } from "@/lib/language-filter";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CourseCurriculum } from "./course-curriculum";
import { CourseEditButton } from "./course-edit-button";

export async function generateMetadata({ params }: PageProps<"/courses/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getCourse(id);

  if (!record) {
    notFound();
  }

  return { title: record.title };
}

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
        actions={
          <CourseEditButton course={{ id: course.id, slug: course.slug, title: course.title }} />
        }
        facts={[
          course.targetLanguage
            ? `${languageName(course.targetLanguage)}, taught in ${languageName(course.language)}`
            : languageName(course.language),
          course.isPublished ? "Published" : "Hidden from learners",
          course.visibility === "private" && "Private",
          formatCount(course.userCount, "learner"),
        ]}
        parents={COURSE_PARENTS}
        title={course.title}
      />

      <AdminDetailBody>
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
      <AdminDetailHeaderSkeleton actions="buttons" parents={COURSE_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton description />
      </AdminDetailBody>
    </>
  );
}
