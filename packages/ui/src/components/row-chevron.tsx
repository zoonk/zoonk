import { ChevronRightIcon } from "lucide-react";

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
