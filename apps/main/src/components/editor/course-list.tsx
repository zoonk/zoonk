import { listOrganizationCourses } from "@zoonk/api/courses";
import { getOrganizationId } from "@zoonk/api/organizations";
import { Badge } from "@zoonk/ui/components/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";

type CourseListProps = {
  orgSlug: string;
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

export async function CourseList({ orgSlug }: CourseListProps) {
  const { data: orgId, error: orgError } = await getOrganizationId(orgSlug);

  if (orgError || !orgId) {
    return null;
  }

  const { data: courses, error: coursesError } =
    await listOrganizationCourses(orgId);

  if (coursesError || courses.length === 0) {
    return null;
  }

  return (
    <ItemGroup>
      {courses.map((course) => (
        <Item asChild key={course.id}>
          <Link href={`/editor/${orgSlug}/${course.slug}`}>
            <ItemMedia variant="image">
              <Image alt="" height={40} src={course.imageUrl} width={40} />
            </ItemMedia>

            <ItemContent>
              <ItemTitle>{course.title}</ItemTitle>
              <ItemDescription>{course.description}</ItemDescription>
            </ItemContent>

            <Badge
              className="text-muted-foreground uppercase"
              variant="secondary"
            >
              {course.language}
            </Badge>

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
