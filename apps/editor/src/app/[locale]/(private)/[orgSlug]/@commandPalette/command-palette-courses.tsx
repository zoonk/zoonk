import { searchCourses } from "@zoonk/core/courses";
import { Badge } from "@zoonk/ui/components/badge";
import { CommandGroup, CommandItem } from "@zoonk/ui/components/command";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Image from "next/image";
import { getExtracted } from "next-intl/server";

type CommandPaletteCoursesProps = {
  orgSlug: string;
  query: string;
};

export async function CommandPaletteCourses({
  orgSlug,
  query,
}: CommandPaletteCoursesProps) {
  const t = await getExtracted();

  if (!query.trim()) {
    return null;
  }

  const { data: courses } = await searchCourses({
    orgSlug,
    title: query,
  });

  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <CommandGroup heading={t("Courses")}>
      {courses.map((course) => (
        <CommandItem
          key={course.id}
          value={`/${orgSlug}/courses/${course.slug}`}
        >
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

export function CommandPaletteCoursesSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      <Skeleton className="h-4 w-16" />
      <div className="flex items-center gap-2">
        <Skeleton className="size-8" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="size-8" />
        <Skeleton className="h-4 flex-1" />
      </div>
    </div>
  );
}
