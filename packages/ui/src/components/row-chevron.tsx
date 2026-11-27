import { ChevronRightIcon, PlusIcon } from "lucide-react";

/**
 * The chevron that ends a row that opens a page, its ink on the row's end edge. The pull moves the
 * glyph, not its place: every glyph keeps a 16px slot, so the value before a ">" ends where the
 * value before a fold arrow does.
 */
export function RowChevron() {
  return (
    <ChevronRightIcon
      aria-hidden="true"
      className="text-faint edge ms-(--edge-pull) -me-(--edge-pull) size-4 shrink-0 self-center"
    />
  );
}

/**
 * The plus that ends a row that starts something new, in the chevron's slot with its ink on the
 * same edge, so the row doesn't read as one more of the items listed under it.
 */
export function RowPlus() {
  return (
    <PlusIcon
      aria-hidden="true"
      className="text-muted-foreground edge ms-(--edge-pull) -me-(--edge-pull) size-4 shrink-0 self-center [--glyph-blank-end:4] [--glyph-blank:4]"
    />
  );
}
