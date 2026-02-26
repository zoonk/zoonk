import { type UserCourse, listUserCourses } from "@/data/courses/list-user-courses";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import {
  CourseListGroup,
  CourseListItemView,
  CourseListSkeleton,
} from "@zoonk/ui/patterns/courses/list";
import { NotebookPenIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Image from "next/image";

function toCourseListItem(course: UserCourse) {
  return {
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl,
    slug: course.slug,
    title: course.title,
  };
}

export async function UserCourseList() {
  const t = await getExtracted();
  const { data: courses } = await listUserCourses();

  if (!courses || courses.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NotebookPenIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("No courses yet")}</EmptyTitle>
          <EmptyDescription>{t("Start learning something new today.")}</EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Link className={buttonVariants({ variant: "outline" })} href="/courses">
            {t("Explore courses")}
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <CourseListGroup layout="list">
      {courses.map((course) => (
        <CourseListItemView
          course={toCourseListItem(course)}
          image={
            course.imageUrl ? (
              <Image alt={course.title} height={64} src={course.imageUrl} width={64} />
            ) : undefined
          }
          key={course.id}
          linkComponent={
            <Link href={`/b/${course.organization?.slug}/c/${course.slug}`} prefetch={false} />
          }
        />
      ))}
    </CourseListGroup>
  );
}

export function UserCourseListSkeleton() {
  return <CourseListSkeleton />;
}
