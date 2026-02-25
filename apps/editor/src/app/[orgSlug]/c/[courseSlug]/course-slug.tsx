import { SlugEditor } from "@/components/slug-editor";
import { getCourse } from "@/data/courses/get-course";
import { checkCourseSlugExists, updateCourseSlugAction } from "./_actions/slug";

export async function CourseSlug({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]">["params"];
}) {
  const { courseSlug, orgSlug } = await params;

  const { data: course } = await getCourse({ courseSlug, orgSlug });

  if (!course) {
    return null;
  }

  return (
    <SlugEditor
      checkFn={checkCourseSlugExists}
      entityId={course.id}
      initialSlug={course.slug}
      language={course.language}
      onSave={updateCourseSlugAction.bind(null, courseSlug, course.language, orgSlug)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/`}
    />
  );
}
