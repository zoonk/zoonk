import { searchCourses } from "@zoonk/core/courses";
import { CommandGroup } from "@zoonk/ui/components/command";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { CommandPaletteCourseItem } from "./course-item";

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

  const { data: courses, error } = await searchCourses({
    orgSlug,
    title: query,
  });

  if (error) {
    console.error("Failed to search courses:", error);
  }

  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <CommandGroup heading={heading}>
      {courses.map((course) => {
        const linkUrl = getLinkUrl(course.slug);
        return (
          <CommandPaletteCourseItem
            imageUrl={course.imageUrl}
            key={course.id}
            language={course.language}
            title={course.title}
            url={linkUrl}
          />
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
