import {
  CourseListGroup,
  CourseListItemView,
} from "@zoonk/ui/patterns/courses/list";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import { NotebookPenIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getExtracted } from "next-intl/server";
import { listDraftCourses } from "@/data/courses/list-draft-courses";

export async function ListCourses({
  params,
}: {
  params: PageProps<"/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;
  const { data: courses } = await listDraftCourses({ orgSlug });

  const t = await getExtracted();

  if (courses.length === 0) {
    return (
      <EmptyView
        description={t("Your organization doesn't have any draft courses.")}
        icon={NotebookPenIcon}
        title={t("No draft courses")}
      />
    );
  }

  return (
    <CourseListGroup layout="list">
      {courses.map((course) => (
        <CourseListItemView
          course={course}
          image={
            course.imageUrl ? (
              <Image
                alt={course.title}
                height={64}
                src={course.imageUrl}
                width={64}
              />
            ) : undefined
          }
          key={course.id}
          linkComponent={
            <Link
              href={`/${orgSlug}/c/${course.language}/${course.slug}`}
              prefetch={true}
            />
          }
        />
      ))}
    </CourseListGroup>
  );
}
