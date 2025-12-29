import { listCourses } from "@/data/courses/list-courses";
import { CourseList } from "./course-list";

export async function ListCourses({
  params,
}: {
  params: PageProps<"/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;
  const { data: courses } = await listCourses({ orgSlug });

  return <CourseList courses={courses} orgSlug={orgSlug} />;
}
