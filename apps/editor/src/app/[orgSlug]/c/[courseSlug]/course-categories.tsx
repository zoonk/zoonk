import { CategoryEditor } from "@/components/category/category-editor";
import { listCourseCategories } from "@/data/categories/list-course-categories";
import { getCourse } from "@/data/courses/get-course";
import { notFound } from "next/navigation";
import { addCourseCategoryAction, removeCourseCategoryAction } from "./_actions/categories";

export async function CourseCategories({
  params,
}: {
  params: PageProps<"/[orgSlug]/c/[courseSlug]">["params"];
}) {
  const { courseSlug, orgSlug } = await params;

  const [{ data: course, error }, { data: categories }] = await Promise.all([
    getCourse({ courseSlug, orgSlug }),
    listCourseCategories({ courseSlug, orgSlug }),
  ]);

  if (error || !course) {
    return notFound();
  }

  const routeParams = {
    courseId: course.id,
    courseSlug,
    orgSlug,
  };

  const categoryStrings = categories?.map((item) => item.category) ?? [];

  return (
    <CategoryEditor
      categories={categoryStrings}
      onAdd={addCourseCategoryAction.bind(null, routeParams)}
      onRemove={removeCourseCategoryAction.bind(null, routeParams)}
    />
  );
}
