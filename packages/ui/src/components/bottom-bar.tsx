import { cn } from "@zoonk/ui/lib/utils";

const ROW_CLASS = "w-full px-(--page-gutter)";

/**
 * The one home of a screen's main action, on a phone and a computer: pinned to the bottom of its
 * frame while the screen scrolls under it. Its buttons never move: what the last action couldn't do
 * goes in `note`, which is drawn over the screen above the bar instead of pushing the bar taller.
 *
 * It reaches the frame's edges by the frame's own padding (`--page-gutter`, `--page-bottom`) and
 * rests on what the frame docks under it (`--page-dock`), so it's the same piece in the app's
 * shell and in a full-screen task. `className` is for the frame's wrapper, to give the row the
 * frame's column; a screen passes none.
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
      {note && (
        <div
          className="bg-background border-border absolute inset-x-0 bottom-full border-t"
          data-slot="bottom-bar-note"
        >
          <div className={cn(ROW_CLASS, "pt-2 text-sm", className)}>{note}</div>
        </div>
      )}

      <div
        className={cn(
          ROW_CLASS,
          "flex flex-col gap-2 pt-3 pb-[max(0.75rem,var(--page-safe-bottom))] lg:items-end",
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
 * A row of the bar's buttons, 8px apart: the main action last, taking the row's width on a phone
 * and sitting at its end on a computer.
 */
function BottomBarActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full flex-wrap items-center gap-2 lg:justify-end", className)}
      data-slot="bottom-bar-actions"
      {...props}
    />
  );
}

export { BottomBar, BottomBarActions };
