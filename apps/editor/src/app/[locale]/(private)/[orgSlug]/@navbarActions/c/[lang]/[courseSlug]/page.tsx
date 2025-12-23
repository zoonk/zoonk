import { getCourse } from "@zoonk/core/courses";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { togglePublishAction } from "./actions";

export default async function CourseNavbarActions({
  params,
}: PageProps<"/[locale]/[orgSlug]/c/[lang]/[courseSlug]">) {
  const { courseSlug, lang, orgSlug } = await params;

  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return null;
  }

  async function handleToggle(isPublished: boolean) {
    "use server";
    return togglePublishAction(course.id, isPublished, orgSlug);
  }

  return (
    <PublishToggle
      courseId={course.id}
      isPublished={course.isPublished}
      onToggle={handleToggle}
    />
  );
}
