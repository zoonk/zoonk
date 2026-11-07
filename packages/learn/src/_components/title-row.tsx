import { cn } from "@zoonk/ui/lib/utils";

/**
 * A title, the first child, then its short values, such as a date, a count, a score or actions, in
 * one element after it. The values sit beside the title, and once the row is too narrow for its text
 * (`stacked:`, which large text or zoom causes on a phone), every value moves under its title, as
 * Apple's rows do at accessibility sizes, so no title is squeezed and no value leaves the screen. A
 * value wider than the whole line wraps inside itself, so values here can't be `whitespace-nowrap`
 * or `shrink-0`, and a word wider than its line breaks rather than run under the next item. The row
 * is a size container, so it must take its width from its parent, as a block or a `flex-1` item.
 */
export const TITLE_ROW_CLASS =
  "@container flex flex-wrap items-center justify-between gap-x-3 wrap-break-word *:first:min-w-0 *:first:flex-1 stacked:*:first:basis-full";

/** Words with a mark after them, such as the Plus mark, which moves under them once their longest word wouldn't fit beside it. */
export function MarkedText({
  children,
  className,
  mark,
}: {
  children: React.ReactNode;
  className?: string;
  mark: React.ReactNode;
}) {
  return (
    <span className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span className="max-w-max grow basis-0">{children}</span>
      {mark}
    </span>
  );
}
