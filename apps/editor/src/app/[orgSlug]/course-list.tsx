import type { Course } from "@zoonk/core/types";
import {
  CourseListGroup,
  CourseListItemView,
} from "@zoonk/ui/patterns/courses/list";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import { NotebookPenIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getExtracted } from "next-intl/server";

export async function CourseList({
  orgSlug,
  courses,
}: {
  orgSlug: string;
  courses: Course[];
}) {
  const t = await getExtracted();

  if (courses.length === 0) {
    return (
      <EmptyView
        description={t("Your organization hasn't created any courses yet.")}
        icon={NotebookPenIcon}
        title={t("No courses")}
      />
    );
  }

  return (
    <CourseListGroup>
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
