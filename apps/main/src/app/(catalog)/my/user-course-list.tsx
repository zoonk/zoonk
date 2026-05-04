import { listUserCourses } from "@/data/courses/list-user-courses";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  CatalogListGroup,
  CatalogListItem,
  CatalogListItemContent,
  CatalogListItemDescription,
  CatalogListItemIcon,
  CatalogListItemImage,
  CatalogListItemTitle,
  CatalogListSkeleton,
} from "@zoonk/ui/components/catalog-list";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { NotebookPenIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

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
          <Link className={buttonVariants({ variant: "outline" })} href="/courses" prefetch>
            {t("Explore courses")}
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <CatalogListGroup>
      {courses.map((course) => (
        <CatalogListItem
          key={course.id}
          render={<Link href={`/b/${course.organization?.slug}/c/${course.slug}`} prefetch />}
        >
          {course.imageUrl ? (
            <CatalogListItemImage>
              <Image alt="" height={64} src={course.imageUrl} width={64} />
            </CatalogListItemImage>
          ) : (
            <CatalogListItemIcon>
              <NotebookPenIcon aria-hidden="true" className="text-muted-foreground/80 size-6" />
            </CatalogListItemIcon>
          )}

          <CatalogListItemContent>
            <CatalogListItemTitle>{course.title}</CatalogListItemTitle>
            <CatalogListItemDescription>{course.description}</CatalogListItemDescription>
          </CatalogListItemContent>
        </CatalogListItem>
      ))}
    </CatalogListGroup>
  );
}

export function UserCourseListSkeleton() {
  return <CatalogListSkeleton />;
}
