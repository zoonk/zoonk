import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { ContentEditor } from "@/components/content-editor";
import { getCourse } from "@/data/courses/get-course";
import {
  updateCourseDescriptionAction,
  updateCourseTitleAction,
} from "./actions";

export async function CourseContent({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;
  const t = await getExtracted();

  const { data: course, error } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (error || !course) {
    return notFound();
  }

  return (
    <ContentEditor
      descriptionLabel={t("Edit course description")}
      descriptionPlaceholder={t("Course description…")}
      entityId={course.id}
      initialDescription={course.description}
      initialTitle={course.title}
      onSaveDescription={updateCourseDescriptionAction.bind(null, courseSlug)}
      onSaveTitle={updateCourseTitleAction.bind(null, courseSlug)}
      titleLabel={t("Edit course title")}
      titlePlaceholder={t("Course title…")}
    />
  );
}
