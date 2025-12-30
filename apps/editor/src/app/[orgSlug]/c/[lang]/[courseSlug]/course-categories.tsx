import { notFound } from "next/navigation";
import { CategoryEditor } from "@/components/category-editor";
import { listCourseCategories } from "@/data/categories/list-course-categories";
import { getCourse } from "@/data/courses/get-course";
import { addCourseCategoryAction, removeCourseCategoryAction } from "./actions";

export async function CourseCategories({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]">["params"];
}) {
  const { courseSlug, lang, orgSlug } = await params;

  const [{ data: course, error }, { data: categories }] = await Promise.all([
    getCourse({ courseSlug, language: lang, orgSlug }),
    listCourseCategories({ courseSlug, language: lang, orgSlug }),
  ]);

  if (error || !course) {
    return notFound();
  }

  const routeParams = {
    courseId: course.id,
    courseSlug,
    lang,
    orgSlug,
  };

  const categoryStrings = categories?.map((c) => c.category) ?? [];

  return (
    <CategoryEditor
      categories={categoryStrings}
      onAdd={addCourseCategoryAction.bind(null, routeParams)}
      onRemove={removeCourseCategoryAction.bind(null, routeParams)}
    />
  );
}
