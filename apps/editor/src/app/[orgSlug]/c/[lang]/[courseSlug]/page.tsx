import { Container } from "@zoonk/ui/components/container";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCourse } from "@/data/courses/get-course";
import { CourseEditor } from "./course-editor";
import { CourseEditorSkeleton } from "./course-editor-skeleton";

async function CourseContent({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;

  const { data: course, error } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (error || !course) {
    return notFound();
  }

  return (
    <CourseEditor
      courseId={course.id}
      initialDescription={course.description}
      initialTitle={course.title}
    />
  );
}

export default async function CoursePage(
  props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">,
) {
  return (
    <Container variant="narrow">
      <Suspense fallback={<CourseEditorSkeleton />}>
        <CourseContent params={props.params} />
      </Suspense>
    </Container>
  );
}
