import { searchCourses } from "@zoonk/core/courses";
import { Badge } from "@zoonk/ui/components/badge";
import { CommandGroup, CommandItem } from "@zoonk/ui/components/command";
import Image from "next/image";
import { getExtracted } from "next-intl/server";

type CatalogCommandPaletteCoursesProps = {
  query: string;
};

/**
 * Server component that fetches and displays AI-generated courses
 * in the command palette based on the search query.
 */
export async function CatalogCommandPaletteCourses({
  query,
}: CatalogCommandPaletteCoursesProps) {
  const t = await getExtracted();

  if (!query.trim()) {
    return null;
  }

  // Search for AI-generated courses (hardcoded orgSlug)
  const { data: courses } = await searchCourses({
    orgSlug: "ai",
    title: query,
  });

  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <CommandGroup heading={t("AI Courses")}>
      {courses.map((course) => (
        <CommandItem key={course.id} value={`/courses/${course.slug}`}>
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
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

export function CatalogCommandPaletteCoursesSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="flex items-center gap-2">
        <div className="size-8 animate-pulse rounded bg-muted" />
        <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-center gap-2">
        <div className="size-8 animate-pulse rounded bg-muted" />
        <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
