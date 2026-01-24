import { SlugEditor } from "@/components/slug-editor";
import { getCourse } from "@/data/courses/get-course";
import { checkCourseSlugExists, updateCourseSlugAction } from "./_actions/slug";

export async function CourseSlug({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;

  const { data: course } = await getCourse({
    courseSlug,
    language: lang,
    orgSlug,
  });

  if (!course) {
    return null;
  }

  return (
    <SlugEditor
      checkFn={checkCourseSlugExists}
      entityId={course.id}
      initialSlug={course.slug}
      language={lang}
      onSave={updateCourseSlugAction.bind(null, courseSlug)}
      orgSlug={orgSlug}
      redirectPrefix={`/${orgSlug}/c/${lang}/`}
    />
  );
}
