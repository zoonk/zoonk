import { cn } from "@zoonk/ui/lib/utils";
import { type CourseCategory, isValidCategory } from "@zoonk/utils/categories";

/** A course's subject: one of its categories, or `general` when it has none Zoonk knows. */
export type Subject = CourseCategory | "general";

type CategoryRow = { category: string; createdAt: Date };

/**
 * A course's subject: its first category, the one its lesson pictures take their palette from, or
 * the general one. Its colors come from `@zoonk/ui`'s one table, through `data-subject`.
 */
export function getSubject(categories: readonly CategoryRow[]): Subject {
  const [first] = categories.toSorted(
    (one, other) => one.createdAt.getTime() - other.createdAt.getTime(),
  );

  return first && isValidCategory(first.category) ? first.category : "general";
}

/**
 * The subject's name on a soft tint of its color, the one place its color sits beside words: over
 * a course's title, on a catalog card. Subtle on purpose, so it names the subject without pulling
 * the eye from the title; plain words with more contrast. Pass the subject's translated name.
 */
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

/**
 * The subject's color as a small square beside its name where the name is already in words: the
 * catalog's list of categories, a key. Decorative.
 */
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
