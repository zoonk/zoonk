/**
 * A title, the first child, then its short values, such as a date, a count, a score or actions, in
 * one element after it. The values stay beside the title while it keeps its whole width or half the
 * line, and move under it otherwise, as Android's `ListRow` does, so large text never squeezes the
 * title or pushes the values off the screen. A value wider than the whole line wraps inside itself,
 * so values here can't be `whitespace-nowrap` or `shrink-0`, and a word wider than its line breaks
 * rather than run under the next item.
 */
export const TITLE_ROW_CLASS =
  "flex flex-wrap items-center justify-between gap-x-3 wrap-break-word *:first:min-w-0 *:first:max-w-max *:first:grow *:first:basis-1/2";
