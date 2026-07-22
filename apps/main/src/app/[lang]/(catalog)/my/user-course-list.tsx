import { listUserCourses } from "@/data/courses/list-user-courses";
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
  ListGroup,
  ListItem,
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

export async function UserCourseList() {
  const t = await getExtracted();
  const courses = await listUserCourses();

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
        <ListItem
          key={course.id}
          render={<Link href={`/b/${course.organization?.slug}/c/${course.slug}`} prefetch />}
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
        </ListItem>
      ))}
    </ListGroup>
  );
}

export function UserCourseListSkeleton() {
  return <ListSkeleton />;
}
