import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The task's column (40rem with its padding), centered in the task's room: the window on a phone
 * and a tablet, and from `lg`, beside an aside, what the aside leaves on its left
 * (`getTaskAsideRootProps`). Everything that lines up with the column takes it: the content, the
 * progress under the title and, on a phone and a tablet, the action bar's row.
 */
export const TASK_COLUMN_CLASS = "max-w-column mx-auto w-full px-4";

/**
 * The action bar's row: the column's on a phone and a tablet, and from `lg` the task's whole room,
 * padded like the header's row, so its buttons sit under the header's corners.
 */
const TASK_BAR_ROW_CLASS = cn(TASK_COLUMN_CLASS, "lg:max-w-none lg:px-6");

/**
 * A full-screen task's content (a lesson's question, a block of the session, a checkpoint, a
 * mock): one column, at the same width and the same left edge on every task and every screen
 * size, starting at the top under the header. Nothing is centered vertically, so a longer
 * question never moves what's above it.
 */
export function TaskBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(TASK_COLUMN_CLASS, "flex flex-1 flex-col gap-6 pt-4 pb-8", className)}
      data-slot="task-body"
      {...props}
    />
  );
}

/**
 * The header's row (`TaskHeaderBar`): close and the menu in its corners and the title between them,
 * centered over the column. It spans the task's room, as the column does: the window, or from
 * `lg` what an aside leaves on its left, so the menu stays clear of the aside.
 */
export const TASK_HEADER_BAR_CLASS = "flex w-full items-center gap-2 px-4 py-2 lg:px-6 xl:py-3";

/**
 * A side of the header's row (close, or the menu), as wide as the other one so the title stays
 * centered over the column.
 */
export const TASK_HEADER_SIDE_CLASS = {
  end: "flex min-w-9 flex-1 basis-0 justify-end",
  start: "flex min-w-9 flex-1 basis-0 justify-start",
} as const;

/** The padding of the action bar's row, shared with the aside's foot so both sit level. */
const BAR_PADDING_CLASS = "pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]";

/**
 * A task's actions, pinned to the bottom of the screen on every size, over a hairline across the
 * task's room: where the thumb is on a phone, and in the same place on every task on a desktop, so
 * the main action never jumps from one screen to the next. On a phone and a tablet its row lines
 * up with the task's column; from `lg` it fills the room, the main action in its bottom-right
 * corner, beside the aside's foot (the buddy's composer, Hand in), which sits level with it. Put
 * the actions in a `TaskActions` row; a quiet line (a save error, an option) can sit above or under
 * it, from `lg` at the right, beside the action it's about.
 */
export function TaskActionBar({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-background border-border sticky bottom-0 z-20 border-t", className)}
      data-slot="task-action-bar"
      {...props}
    >
      <div
        className={cn(TASK_BAR_ROW_CLASS, "flex flex-col gap-2 lg:items-end", BAR_PADDING_CLASS)}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The bar's one row. On a phone the main action (`TASK_MAIN_ACTION_CLASS`) takes the width the
 * secondary ones leave (Back, Flag, See mistakes, Ask Buddy). From `lg`, where the bar is wide
 * enough that a full-width button reads as a banner, every button is as wide as its label: Back
 * (`TASK_BACK_ACTION_CLASS`) holds the bar's left edge, under close, and the rest its right edge,
 * the main action last, in the corner where the eye ends.
 */
export function TaskActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full items-center gap-2.5 lg:justify-end", className)}
      data-slot="task-actions"
      {...props}
    />
  );
}

/**
 * The main action's width in a `TaskActions` row: the rest of the row on a phone, and its label's
 * width from `lg` (at least 10rem). It takes the row's width and shrinks beside the secondary
 * actions (buttons don't shrink by default) instead of taking `flex-1`: a zero basis would also
 * squeeze its 44px height to its label's in a column.
 */
export const TASK_MAIN_ACTION_CLASS =
  "w-full min-w-0 shrink grow lg:w-auto lg:min-w-40 lg:shrink-0 lg:grow-0";

/** Back, the 44px square on the row's left, which keeps the bar's left edge from `lg`. */
export const TASK_BACK_ACTION_CLASS = "size-11 shrink-0 lg:mr-auto";

/**
 * How wide the aside is: the default rail (300px, 320px from `xl`, as wide as the app's aside), or
 * a second column as wide as the task's for a long shared text read beside its question (half the
 * window when both don't fit).
 */
export type TaskAsideWidth = "default" | "half";

const ASIDE_WIDTH_CLASS: Record<TaskAsideWidth, string> = {
  default: "lg:[--task-aside:18.75rem] xl:[--task-aside:20rem]",
  half: "lg:[--task-aside:min(40rem,50%)]",
};

/**
 * The root of a task with an aside (`TaskFrame`, the lesson player). From `lg` the aside runs the
 * window's full height at its right edge behind a hairline, as the app's aside does, and the task
 * keeps the room on its left (`--task-aside`, the aside's width): its header's row, its column,
 * centered there, and its action bar. It also tells what sits in the aside where the aside's body
 * starts and ends: under the aside's own header row, as tall as the task's (`--task-bar`, the row's
 * height at `py-2` and `py-3` around its 36px buttons), and above its foot (`--task-aside-bottom`),
 * the action bar's row (73px), where the buddy's composer or Hand in sits level with the bar, or the
 * buddy's dock when its suggestions make it taller (`--task-dock`, as it measures itself).
 */
export function getTaskAsideRootProps({ width = "default" }: { width?: TaskAsideWidth } = {}) {
  return {
    className: cn(
      "group/task lg:pr-(--task-aside)",
      "lg:[--task-aside-bottom:max(4.5625rem,var(--task-dock,0px))] lg:[--task-bar:3.25rem] xl:[--task-bar:3.75rem]",
      ASIDE_WIDTH_CLASS[width],
    ),
    "data-aside": width,
  };
}

/** The aside from `lg`: the window's right edge, its full height, behind a hairline. */
const TASK_ASIDE_RAIL_CLASS =
  "border-border lg:fixed lg:inset-y-0 lg:right-0 lg:w-(--task-aside) lg:border-l";

/**
 * Where what joins the aside sits from `lg` (its content, the buddy's dock and conversation, its
 * foot): at the window's right edge, fixed while the task scrolls, inside the aside's hairline, so
 * what's drawn over the aside never covers it.
 */
export const TASK_ASIDE_PLACE_CLASS = "lg:fixed lg:right-0 lg:w-[calc(var(--task-aside)-1px)]";

/**
 * The aside's header row, at its top, level with the task's header row: its label on the left in
 * the section-label face, a quiet mono fact on the right ("18 min left").
 */
export function TaskAsideHeader({
  className,
  meta,
  title,
}: {
  className?: string;
  meta?: React.ReactNode;
  title?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-13 shrink-0 items-center justify-between gap-3 px-5 xl:h-15",
        className,
      )}
      data-slot="task-aside-header"
    >
      {title && <h2 className="text-label min-w-0 truncate">{title}</h2>}
      {meta && (
        <p className="text-muted-foreground ml-auto shrink-0 font-mono text-xs tabular-nums">
          {meta}
        </p>
      )}
    </div>
  );
}

/**
 * What helps with the task, beside it from `lg` (tablets in landscape and up): what the learner acts
 * on and reads to do it stays in the column, what helps them sits in the aside, a quiet rail at the
 * window's right edge that runs its full height behind a hairline, as the app's aside does
 * (`getTaskAsideRootProps`). It draws no panel: its words sit on the page, so a rail with only the
 * buddy at its foot reads as the page's edge, never an empty box. Its header row, level with the
 * task's, has a label on the left and a quiet mono fact on the right, its body scrolls on its own,
 * and its foot (`footer`) sits level with the action bar. Phones and tablets in portrait don't show
 * it: what it holds is in the column there, or one tap away.
 */
export function TaskAside({
  children,
  footer,
  label,
  meta,
  title,
}: {
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** The aside's name for screen readers. */
  label: string;
  meta?: React.ReactNode;
  title?: React.ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className={cn(
        "bg-background hidden lg:flex lg:flex-col lg:pb-(--task-aside-bottom)",
        TASK_ASIDE_RAIL_CLASS,
      )}
      data-slot="task-aside"
    >
      <TaskAsideHeader meta={meta} title={title} />

      <div
        className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 pb-6"
        data-slot="task-aside-body"
      >
        {children}
      </div>

      {footer && (
        <div
          className={cn(
            "bg-background flex flex-col gap-2 px-5 lg:bottom-0",
            TASK_ASIDE_PLACE_CLASS,
            BAR_PADDING_CLASS,
          )}
          data-slot="task-aside-footer"
        >
          {footer}
        </div>
      )}
    </aside>
  );
}

/**
 * What a task shows in its column on a phone and in the aside's body from `lg`, beside the column:
 * a long text several questions share, an essay's motivating texts, an intro's details. A
 * question's own situation, picture, chart or table is part of the question and stays with it in
 * the column at every size, as does what the learner needs to answer (an essay's instruction, a
 * drill's rule). It's rendered once, where screen readers hear it before what follows, and only
 * its place changes: nothing is drawn twice, and nothing moves after the page loads. In the aside
 * it starts under the aside's header row (`top-0` for content that draws its own), scrolls on its
 * own and fades out at its foot while there's more to read, and the buddy's conversation docked
 * over the aside hides it until it closes. In a task without an aside it stays in the column.
 * Nothing between it and the task's root may set a transform, which would hold it in place.
 */
export function TaskAsideContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "lg:group-data-aside/task:scroll-fade-b lg:top-(--task-bar) lg:right-0 lg:bottom-(--task-aside-bottom) lg:w-[calc(var(--task-aside)-1px)] lg:group-has-data-[slot$=docked-conversation]/task:invisible lg:group-data-aside/task:fixed lg:group-data-aside/task:z-30 lg:group-data-aside/task:overflow-y-auto lg:group-data-aside/task:px-5 lg:group-data-aside/task:pb-6",
        className,
      )}
      data-slot="task-aside-content"
      {...props}
    />
  );
}

/** A block of the aside's body: its label, then its rows or text. */
export function TaskAsideSection({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)} data-slot="task-aside-section">
      {title && <h3 className="text-label">{title}</h3>}
      {children}
    </section>
  );
}

/**
 * A task's chrome while its screen loads, in its final shapes, so nothing moves when the screen
 * arrives: the header's row (close and the menu, when `menu`, in its corners, the title's
 * placeholder centered over the column), the progress bar under it when `progress`, the screen's
 * own placeholders (`children`), the action bar pinned over a hairline (the screen's secondary
 * `actions`, then its main action, label-width from `lg`) and, for a task with an aside, the aside
 * at the window's right edge from `lg`, behind its hairline, with its placeholders.
 */
export function TaskSkeleton({
  actions,
  aside,
  children,
  menu = false,
  progress = false,
  title,
}: {
  actions?: React.ReactNode;
  /** The aside's placeholders, or `true` for an aside that shows nothing until the screen does. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  menu?: boolean;
  progress?: boolean;
  title?: React.ReactNode;
}) {
  const root = aside ? getTaskAsideRootProps() : null;

  return (
    <main
      className={cn("flex min-h-dvh flex-col", root?.className)}
      data-aside={root?.["data-aside"]}
    >
      <div className="border-b border-transparent">
        <div className={TASK_HEADER_BAR_CLASS}>
          <div className={TASK_HEADER_SIDE_CLASS.start}>
            <Skeleton className="-ml-2.5 size-9 rounded-lg" />
          </div>
          <div className="flex min-w-0 justify-center">{title}</div>
          <div className={TASK_HEADER_SIDE_CLASS.end}>
            {menu && <Skeleton className="-mr-2.5 size-9 rounded-lg" />}
          </div>
        </div>

        {progress && (
          <div className={cn(TASK_COLUMN_CLASS, "pb-1")}>
            <Skeleton className="h-1 w-full rounded-xs" />
          </div>
        )}
      </div>

      <div className={cn(TASK_COLUMN_CLASS, "flex flex-1 flex-col gap-4 pt-4 pb-8")}>
        {children}
      </div>

      <div className="border-border border-t">
        <div className={cn(TASK_BAR_ROW_CLASS, "flex gap-2.5 lg:justify-end", BAR_PADDING_CLASS)}>
          {actions}
          <Skeleton className="h-11 w-full rounded-lg lg:w-40" />
        </div>
      </div>

      {aside && (
        <div className={cn("hidden flex-col gap-4 px-5 lg:flex", TASK_ASIDE_RAIL_CLASS)}>
          {aside !== true && (
            <>
              <div className="flex h-13 shrink-0 items-center xl:h-15">
                <Skeleton className="h-3 w-28" />
              </div>
              {aside}
            </>
          )}
        </div>
      )}
    </main>
  );
}
