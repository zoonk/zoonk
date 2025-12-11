import type { Course } from "@zoonk/core/types";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import { ChevronRightIcon, NotebookPenIcon } from "lucide-react";
import Image from "next/image";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type CourseListProps = {
  orgSlug: string;
  courses: Course[];
};

export function CourseListSkeleton() {
  return (
    <ItemGroup>
      {Array.from({ length: 3 }).map((_, index) => (
        <Item key={index}>
          <ItemMedia variant="image">
            <Skeleton className="size-10" />
          </ItemMedia>

          <ItemContent>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-72" />
          </ItemContent>

          <Skeleton className="h-5 w-10 rounded-full" />

          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </Item>
      ))}
    </ItemGroup>
  );
}

export async function CourseList({ orgSlug, courses }: CourseListProps) {
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
    <ItemGroup>
      {courses.map((course) => (
        <Item asChild key={course.id}>
          <Link href={`/${orgSlug}/${course.slug}`}>
            <ItemMedia className="size-16" variant="image">
              <Image
                alt={course.title}
                height={64}
                src={course.imageUrl}
                width={64}
              />
            </ItemMedia>

            <ItemContent>
              <ItemTitle>{course.title}</ItemTitle>
              <ItemDescription>{course.description}</ItemDescription>
            </ItemContent>

            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          </Link>
        </Item>
      ))}
    </ItemGroup>
  );
}
