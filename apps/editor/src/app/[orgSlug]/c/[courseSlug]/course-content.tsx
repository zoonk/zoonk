import { ContentEditor } from "@/components/content-editor";
import { getCourse } from "@/data/courses/get-course";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import { updateCourseDescriptionAction, updateCourseTitleAction } from "./_actions/content";

export async function CourseContent({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]">["params"];
}) {
  const { courseSlug, orgSlug } = await params;
  const t = await getExtracted();

  const { data: course, error } = await getCourse({ courseSlug, orgSlug });

  if (error || !course) {
    return notFound();
  }

  return (
    <ContentEditor
      descriptionLabel={t("Edit course description")}
      descriptionPlaceholder={t("Course description…")}
      entityId={course.id}
      initialDescription={course.description ?? ""}
      initialTitle={course.title}
      onSaveDescription={updateCourseDescriptionAction}
      onSaveTitle={updateCourseTitleAction}
      titleLabel={t("Edit course title")}
      titlePlaceholder={t("Course title…")}
    />
  );
}
