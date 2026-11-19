import { cn } from "@zoonk/ui/lib/utils";

/** Under `lg` the buttons fill the content's measure; from `lg` the main action ends at the bar's end. */
const ROW_CLASS =
  "w-full max-w-[calc(var(--page-measure,100%)+2*var(--page-gutter))] px-(--page-gutter) lg:max-w-none";

/**
 * The frame's gutter, 16px on a phone and 20px from `sm` (`--spacing-frame`): its side padding, and the bottom bar's
 * room over and under its buttons (`BOTTOM_BAR_ROOM_CLASS`). The two are one number on purpose: a
 * button alone in the bar's corner reads right only with the same inset from both edges. Every
 * frame that draws app pages takes it from here: the app's shell, a full page drawn without it,
 * the internal tools' pages.
 */
export const FRAME_GUTTER_CLASS =
  "[--page-gutter:--spacing(4)] sm:[--page-gutter:var(--spacing-frame)]";

/**
 * The bar's room over and under its buttons: the frame's gutter, 16px where the frame names none,
 * and the home indicator's inset where nothing is docked under it. A foot drawn level with the bar
 * (a task's side panel) takes the same room under the same gutter.
 */
export const BOTTOM_BAR_ROOM_CLASS =
  "pt-[max(1rem,var(--page-gutter))] pb-[max(1rem,var(--page-gutter),var(--page-safe-bottom))]";

/**
 * The one home of a screen's main action, on a phone and a computer: pinned to the bottom of its
 * frame while the screen scrolls under it. Its buttons never move: what the last action couldn't do
 * goes in `note`, which is drawn over the screen above the bar instead of pushing the bar taller,
 * and read to screen readers as it appears: pass its words (an error that must interrupt keeps
 * `role="alert"`).
 *
 * It reaches the frame's edges by the frame's own padding (`--page-gutter`, `--page-bottom`) and
 * rests on what the frame docks under it (`--page-dock`), so it's the same piece in the app's
 * shell and in a full-screen task. The frame's gutter is the room at its sides and over and under
 * its buttons alike (`BOTTOM_BAR_ROOM_CLASS`), so the main action's corner is even. On a phone and a tablet its
 * buttons fill the content's measure; on a computer the main action sits at the bar's end, one
 * gutter in from its edge, wherever the content's column ends, and the note ends on that edge too.
 * `className` is for the frame's wrapper, to give the row the frame's gutter; a screen passes none.
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
            <div
              className={cn(
                ROW_CLASS,
                "pt-[max(1rem,var(--page-gutter))] text-sm lg:text-end",
                className,
              )}
            >
              {note}
            </div>
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
