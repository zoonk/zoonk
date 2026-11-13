/**
 * A page top action with a glyph and words: on a phone the glyph alone in `icon-bar`'s 44px
 * square, from `sm` the words beside it. Spread on the `Button`, with `BarActionLabel` inside.
 */
export const BAR_GLYPH_ACTION = { className: "max-sm:px-3.5", size: "bar" } as const;

export function BarActionLabel({ children }: { children: React.ReactNode }) {
  return <span className="sr-only sm:not-sr-only">{children}</span>;
}
