import { searchCourses } from "@zoonk/core/courses";
import { Badge } from "@zoonk/ui/components/badge";
import { CommandGroup, CommandItem } from "@zoonk/ui/components/command";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Image from "next/image";

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
    <CommandGroup heading={heading}>
      {courses.map((course) => {
        const linkUrl = getLinkUrl(course.slug);
        return (
          <CommandItem key={course.id} value={linkUrl}>
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
        );
      })}
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
