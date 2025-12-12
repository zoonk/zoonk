import { searchCourses } from "@zoonk/core/courses";
import { Badge } from "@zoonk/ui/components/badge";
import Image from "next/image";
import { CommandPaletteItem } from "./item";
import {
  CommandPaletteResultsGroup,
  CommandPaletteResultsSkeleton,
  searchWithValidation,
} from "./results-group";

export type CommandPaletteCoursesProps = {
  orgSlug: string;
  query: string;
  heading: string;
  getLinkUrl: (courseSlug: string) => string;
};

export async function CommandPaletteCourses({
  orgSlug,
  query,
  heading,
  getLinkUrl,
}: CommandPaletteCoursesProps) {
  const courses = await searchWithValidation(query, () =>
    searchCourses({ orgSlug, title: query }),
  );

  if (!courses) {
    return null;
  }

  return (
    <CommandPaletteResultsGroup heading={heading}>
      {courses.map((course) => (
        <CommandPaletteItem href={getLinkUrl(course.slug)} key={course.id}>
          <Image
            alt={course.title}
            className="size-8 rounded object-cover"
            height={32}
            src={course.imageUrl}
            width={32}
          />
          <span className="flex-1">{course.title}</span>
          <Badge className="uppercase" variant="outline">
            {course.language}
          </Badge>
        </CommandPaletteItem>
      ))}
    </CommandPaletteResultsGroup>
  );
}

/**
 * Skeleton for course search results.
 * Shows 2 items with image placeholders by default.
 */
export function CommandPaletteCoursesSkeleton() {
  return <CommandPaletteResultsSkeleton />;
}
