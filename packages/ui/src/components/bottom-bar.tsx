import { cn } from "@zoonk/ui/lib/utils";

const ROW_CLASS = "w-full px-(--page-gutter)";

/**
 * The frame's side padding at each size: the app's shell, a full page drawn without it, and the
 * toasts that rise over the bar this sets the height of.
 */
export const FRAME_GUTTER_CLASS =
  "[--page-gutter:--spacing(4)] sm:[--page-gutter:--spacing(8)] lg:[--page-gutter:--spacing(10)]";

/**
 * The one home of a screen's main action, on a phone and a computer: pinned to the bottom of its
 * frame while the screen scrolls under it. Its buttons never move: what the last action couldn't do
 * goes in `note`, which is drawn over the screen above the bar instead of pushing the bar taller,
 * and read to screen readers as it appears: pass its words (an error that must interrupt keeps
 * `role="alert"`).
 *
 * It reaches the frame's edges by the frame's own padding (`--page-gutter`, `--page-bottom`) and
 * rests on what the frame docks under it (`--page-dock`), so it's the same piece in the app's
 * shell and in a full-screen task. Its buttons have the same room over and under them as at
 * their sides: the frame's gutter, and 16px where the frame names none. `className` is for the
 * frame's wrapper, to give the row the frame's column and gutter; a screen passes none.
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
            <div className={cn(ROW_CLASS, "pt-2 text-sm lg:text-end", className)}>{note}</div>
          </div>
        )}
      </div>

      <div
        className={cn(
          ROW_CLASS,
          "flex flex-col gap-2 pt-[max(1rem,var(--page-gutter))] pb-[max(1rem,var(--page-gutter),var(--page-safe-bottom))] lg:items-end",
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
 * A row of the bar's buttons, 8px apart, the main action last. The main action (the one Enter
 * presses) takes what the row has left on a phone and its own width at the row's end on a computer.
 */
function BottomBarActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-2 *:data-enter:grow lg:justify-end lg:*:data-enter:grow-0",
        className,
      )}
      data-slot="bottom-bar-actions"
      {...props}
    />
  );
}

export { BottomBar, BottomBarActions };
