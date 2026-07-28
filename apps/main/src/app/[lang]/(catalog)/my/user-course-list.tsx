import { Link } from "@/i18n/navigation";
import { listCurrentUserCourses } from "@zoonk/core/courses/list-current-user";
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
  ListGroup,
  ListItem,
  ListItemActions,
  ListItemContent,
  ListItemDescription,
  ListItemIcon,
  ListItemImage,
  ListItemTitle,
  ListSkeleton,
} from "@zoonk/ui/components/list";
import { NotebookPenIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Image from "next/image";
import { RemoveCourseMenu } from "./remove-course-menu";

export async function UserCourseList() {
  const t = await getExtracted();
  const courses = await listCurrentUserCourses();

  if (courses.length === 0) {
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
          <Link className={buttonVariants({ variant: "outline" })} href="/start" prefetch>
            {t("Start a course")}
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ListGroup>
      {courses.map((course) => (
        <ListItem className="gap-0 p-0" key={course.id}>
          <Link
            className="focus-visible:ring-ring/50 hover:bg-muted flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl px-4 py-2.5 transition-colors outline-none focus-visible:ring-[3px]"
            href={`/b/${course.organization?.slug}/c/${course.slug}`}
            prefetch
          >
            {course.imageUrl ? (
              <ListItemImage>
                <Image alt={course.title} height={64} src={course.imageUrl} width={64} />
              </ListItemImage>
            ) : (
              <ListItemIcon>
                <NotebookPenIcon aria-hidden="true" className="text-muted-foreground/80 size-6" />
              </ListItemIcon>
            )}

            <ListItemContent>
              <ListItemTitle>{course.title}</ListItemTitle>
              <ListItemDescription>{course.description}</ListItemDescription>
            </ListItemContent>
          </Link>

          <ListItemActions className="pr-3">
            <RemoveCourseMenu courseId={course.id} courseTitle={course.title} />
          </ListItemActions>
        </ListItem>
      ))}
    </ListGroup>
  );
}

export function UserCourseListSkeleton() {
  return <ListSkeleton />;
}
