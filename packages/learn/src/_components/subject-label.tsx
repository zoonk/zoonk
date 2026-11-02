import { cn } from "@zoonk/ui/lib/utils";
import { type CourseCategory, isValidCategory } from "@zoonk/utils/categories";

export type Subject = CourseCategory | "general";

type CategoryRow = { category: string; createdAt: Date };

export function getSubject(categories: readonly CategoryRow[]): Subject {
  const [first] = categories.toSorted(
    (one, other) => one.createdAt.getTime() - other.createdAt.getTime(),
  );

  return first && isValidCategory(first.category) ? first.category : "general";
}

export function SubjectLabel({
  children,
  className,
  subject,
}: React.PropsWithChildren<{ className?: string; subject: Subject }>) {
  return (
    <span
      className={cn(
        "bg-subject-tint text-subject-text inline-flex h-5.5 w-fit shrink-0 items-center rounded-md px-2 text-xs leading-none font-[550]",
        className,
      )}
      data-slot="subject-label"
      data-subject={subject}
    >
      {children}
    </span>
  );
}

export function SubjectGlyph({ className, subject }: { className?: string; subject: Subject }) {
  return (
    <span
      aria-hidden="true"
      className={cn("bg-subject size-2 shrink-0 rounded-[2px]", className)}
      data-slot="subject-glyph"
      data-subject={subject}
    />
  );
}
