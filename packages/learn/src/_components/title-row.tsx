import { cn } from "@zoonk/ui/lib/utils";

/**
 * A title, the first child, then its short values, such as a date, a count, a score or actions, in
 * one element after it. The values sit beside the title while it keeps its whole width or 6rem, about
 * a dozen characters, and move under it otherwise; once the row is too narrow for its text
 * (`stacked:`, which large text or zoom causes on a phone), every value moves under its title, as
 * Apple's rows do at accessibility sizes. A value wider than the whole line wraps inside itself, so
 * values here can't be `whitespace-nowrap` or `shrink-0`, and a word wider than its line breaks
 * rather than run under the next item. The row is a size container, so it must take its width from
 * its parent, as a block or a `flex-1` item.
 */
export const TITLE_ROW_CLASS =
  "@container flex flex-wrap items-center justify-between gap-x-3 wrap-break-word *:first:min-w-0 *:first:max-w-max *:first:grow *:first:basis-24 stacked:*:first:max-w-none stacked:*:first:basis-full";

/** A title row's title that truncates beside its values, and reads in full once the row stacks. */
export const TRUNCATED_TITLE_CLASS = "truncate stacked:whitespace-normal";

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
    <span className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 wrap-break-word", className)}>
      <span className="max-w-max min-w-0 flex-[1_1_min-content]">{children}</span>
      {mark}
    </span>
  );
}
