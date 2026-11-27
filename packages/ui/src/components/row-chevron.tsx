import { ChevronRightIcon } from "lucide-react";
import { BusyIcon } from "./button";

/**
 * The chevron that ends a row that opens a page, its ink on the row's end edge. The pull moves the
 * glyph, not its place: every glyph keeps a 16px slot, so the value before a ">" ends where the
 * value before a fold arrow does. It gives way to the spinner while its row is busy or held.
 */
export function RowChevron() {
  return (
    <BusyIcon className="text-muted-foreground edge ms-(--edge-pull) -me-(--edge-pull) size-4 shrink-0 self-center">
      <ChevronRightIcon aria-hidden="true" className="text-faint size-full" />
    </BusyIcon>
  );
}
