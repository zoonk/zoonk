import { getTaskPath } from "@/lib/review-utils";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";

/**
 * Reviewers often need to audit every generated image in one lesson before
 * moving back to the global queue, so this keeps the lesson scope in the URL
 * and lets normal server rendering fetch the narrowed queue.
 */
export function LessonSlugFilter({ lessonSlug }: { lessonSlug?: string }) {
  const taskPath = getTaskPath("stepImage");

  return (
    <form
      action={taskPath}
      className="flex flex-col gap-2 sm:max-w-xl sm:flex-row sm:items-center"
      method="get"
    >
      <label className="sr-only" htmlFor="lesson-slug">
        Lesson slug
      </label>

      <Input
        className="sm:flex-1"
        defaultValue={lessonSlug}
        id="lesson-slug"
        name="lessonSlug"
        placeholder="Filter by lesson slug"
        type="search"
      />

      <div className="flex shrink-0 gap-2">
        <Button type="submit" variant="outline">
          <SearchIcon />
          Filter
        </Button>

        {lessonSlug ? (
          <Link
            aria-label="Clear lesson slug filter"
            className={buttonVariants({ size: "icon", variant: "ghost" })}
            href={taskPath}
          >
            <XIcon />
          </Link>
        ) : null}
      </div>
    </form>
  );
}
