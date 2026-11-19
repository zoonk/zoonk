import { cn } from "@zoonk/ui/lib/utils";

const ROW_CLASS =
  "w-full max-w-[calc(var(--page-measure,100%)+2*var(--page-gutter))] px-(--page-gutter)";

/** The frame's side padding at each size: the app's shell and a full page drawn without it. */
export const FRAME_GUTTER_CLASS =
  "[--page-gutter:--spacing(4)] sm:[--page-gutter:--spacing(8)] lg:[--page-gutter:--spacing(10)]";

/**
 * The bar's room over and under its buttons, 16px at every size, so the bar stays as compact on a
 * computer as on a phone (77px with its hairline), plus the home indicator's inset where nothing is
 * docked under it. A foot drawn level with the bar (a task's side panel) takes the same room.
 */
export const BOTTOM_BAR_ROOM_CLASS = "pt-4 pb-[max(1rem,var(--page-safe-bottom))]";

/**
 * The one home of a screen's main action, on a phone and a computer: pinned to the bottom of its
 * frame while the screen scrolls under it. Its buttons never move: what the last action couldn't do
 * goes in `note`, which is drawn over the screen above the bar instead of pushing the bar taller,
 * and read to screen readers as it appears: pass its words (an error that must interrupt keeps
 * `role="alert"`).
 *
 * It reaches the frame's edges by the frame's own padding (`--page-gutter`, `--page-bottom`) and
 * rests on what the frame docks under it (`--page-dock`), so it's the same piece in the app's
 * shell and in a full-screen task. Its sides are the frame's gutter, so its buttons line up with the
 * page; over and under them it keeps its own 16px (`BOTTOM_BAR_ROOM_CLASS`), whatever the gutter.
 * `className` is for the frame's wrapper, to give the row the frame's column and gutter; a screen
 * passes none.
 */
function BottomBar({
  children,
  className,
  note,
  ...props
}: React.ComponentProps<"div"> & { note?: React.ReactNode }) {
  return (
    <div
      className="bg-background border-border sticky bottom-(--page-dock) z-20 -mx-(--page-gutter) -mb-(--page-bottom) border-t outline-none has-[>[data-slot=bottom-bar-row]:empty]:hidden"
      data-slot="bottom-bar"
      {...props}
    >
      {/* Mounted while empty: a screen reader reads a line added to a live region it already knows. */}
      <div
        aria-live="polite"
        className="absolute inset-x-0 bottom-full"
        data-slot="bottom-bar-note"
      >
        {note && (
          <div className="bg-background border-border border-t">
            {/* The bar's own room over its buttons, so the note sits as far from its line as the buttons sit from the note. */}
            <div className={cn(ROW_CLASS, "pt-4 text-sm lg:text-end", className)}>{note}</div>
          </div>
        )}
      </div>

      <div
        className={cn(
          ROW_CLASS,
          "flex flex-col gap-2 lg:items-end",
          BOTTOM_BAR_ROOM_CLASS,
          className,
        )}
        data-slot="bottom-bar-row"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A row of the bar's buttons, 8px apart, the main action last: on a phone each fills the line it has
 * alone and the main action (the one Enter presses) takes what a line it shares has left
 * (`bar-actions`); on a computer they keep their own width at the row's end.
 */
function BottomBarActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bar-actions flex w-full flex-wrap items-center gap-2 lg:justify-end",
        className,
      )}
      data-slot="bottom-bar-actions"
      {...props}
    />
  );
}

export { BottomBar, BottomBarActions };
