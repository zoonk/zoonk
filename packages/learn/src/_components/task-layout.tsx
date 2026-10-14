import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * A full-screen task's content (a lesson's question, a block of the session, a checkpoint, a
 * mock): one column, at the same width and the same left edge on every task and every screen
 * size, starting at the top under the header. Nothing is centered vertically, so a longer
 * question never moves what's above it.
 */
export function TaskBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-column mx-auto flex w-full flex-1 flex-col gap-6 px-4 pt-4 pb-8",
        className,
      )}
      data-slot="task-body"
      {...props}
    />
  );
}

/** The padding of the action bar's row, shared with the aside's foot so both sit level. */
const BAR_PADDING_CLASS = "pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]";

/**
 * A task's actions, pinned to the bottom of the screen on every size, over a hairline: where the
 * thumb is on a phone, and in the same place on every task on a desktop, so the main action never
 * jumps from one screen to the next. Its column lines up with the task's. Put the actions in a
 * `TaskActions` row; a quiet line (a save error, an option) can sit above or under it.
 */
export function TaskActionBar({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-background border-border sticky bottom-0 z-20 border-t", className)}
      data-slot="task-action-bar"
      {...props}
    >
      <div
        className={cn("max-w-column mx-auto flex w-full flex-col gap-2 px-4", BAR_PADDING_CLASS)}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The bar's one row. On a phone the main action (`TASK_MAIN_ACTION_CLASS`) takes the width the
 * secondary ones leave (Back, Flag, See mistakes, Ask Buddy). From `lg`, where the column is wide
 * enough that a full-width button reads as a banner, every button is as wide as its label: Back
 * (`TASK_BACK_ACTION_CLASS`) holds the column's left edge and the rest its right edge, the main
 * action last, where the eye ends.
 */
export function TaskActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2.5 lg:justify-end", className)}
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

/** Back, the 44px square on the row's left, which keeps the column's left edge from `lg`. */
export const TASK_BACK_ACTION_CLASS = "size-11 shrink-0 lg:mr-auto";

/**
 * How wide the aside is: the default rail (22rem, 26rem from `xl`), or half the screen for a long
 * shared text read beside its question.
 */
export type TaskAsideWidth = "default" | "half";

const ASIDE_WIDTH_CLASS: Record<TaskAsideWidth, string> = {
  default: "lg:[--task-aside:22rem] xl:[--task-aside:26rem]",
  half: "lg:[--task-aside:50vw]",
};

/**
 * The root of a task with an aside (`TaskFrame`, the lesson player): it keeps the aside's room
 * free on the right from `lg`, so the task's column centers in what's left, and tells
 * `TaskAsideContent` where the aside's body is.
 */
export function getTaskAsideRootProps({
  footer,
  width = "default",
}: {
  footer: boolean;
  width?: TaskAsideWidth;
}) {
  return {
    className: cn(
      "group/task lg:pr-(--task-aside) lg:[--task-aside-top:3.25rem] xl:[--task-aside-top:3.75rem]",
      footer && "lg:[--task-aside-bottom:4.5625rem]",
      ASIDE_WIDTH_CLASS[width],
    ),
    "data-aside": width,
  };
}

/**
 * The aside's header row, level with the task's header: its label on the left in the section-label
 * face, a quiet mono fact on the right ("18 min left").
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
        "flex h-13 shrink-0 items-center justify-between gap-3 px-6 xl:h-15",
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
 * What helps with the task, beside it from `lg` (tablets in landscape and up), full height behind
 * a hairline: what the learner acts on stays in the column on the left, what helps them on the
 * right. Its header row sits level with the task's header (a label on the left, a quiet mono fact
 * on the right), its body scrolls on its own, and its foot (`TaskAsideFooter`) sits level with the
 * action bar. Phones and tablets in portrait don't show it: what it holds is in the column there,
 * or one tap away.
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
      className="border-border bg-background hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-20 lg:flex lg:w-(--task-aside) lg:flex-col lg:border-l"
      data-slot="task-aside"
    >
      <TaskAsideHeader meta={meta} title={title} />

      <div
        className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-6 pb-6"
        data-slot="task-aside-body"
      >
        {children}
      </div>

      {footer && (
        <div
          className={cn("border-border flex flex-col gap-2 border-t px-4", BAR_PADDING_CLASS)}
          data-slot="task-aside-footer"
        >
          {footer}
        </div>
      )}
    </aside>
  );
}

/**
 * What a question shows before it on a phone (the shared text it's on, its context, chart or
 * picture), placed in the aside's body from `lg`, beside the question. It's rendered once, where
 * screen readers hear it before the question, and only its place changes: nothing is drawn twice,
 * and nothing moves after the page loads. In a task without an aside it stays in the column.
 * Nothing between it and the task's root may set a transform, which would hold it in place.
 */
export function TaskAsideContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "lg:top-(--task-aside-top) lg:right-0 lg:bottom-(--task-aside-bottom) lg:w-(--task-aside) lg:group-data-aside/task:fixed lg:group-data-aside/task:z-30 lg:group-data-aside/task:overflow-y-auto lg:group-data-aside/task:px-6 lg:group-data-aside/task:pb-6",
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
 * arrives: the header's row in the column (close, the title's placeholder, the menu when `menu`),
 * the progress bar under it when `progress`, the screen's own placeholders (`children`), the action
 * bar pinned over a hairline (the screen's secondary `actions`, then its main action, label-width
 * from `lg`) and, for a task with an aside, the aside's placeholders beside them from `lg`.
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
  aside?: React.ReactNode;
  children: React.ReactNode;
  menu?: boolean;
  progress?: boolean;
  title?: React.ReactNode;
}) {
  return (
    <main className={cn("flex min-h-dvh flex-col", aside && "lg:pr-88 xl:pr-104")}>
      <div className="max-w-column mx-auto flex w-full items-center justify-between gap-2 px-4 py-2 xl:py-3">
        <Skeleton className="-ml-2.5 size-9 rounded-lg" />
        {title}
        {menu ? <Skeleton className="-mr-2.5 size-9 rounded-lg" /> : <span className="size-9" />}
      </div>

      {progress && (
        <div className="max-w-column mx-auto w-full px-4 pb-1">
          <Skeleton className="h-1 w-full rounded-xs" />
        </div>
      )}

      <div className="max-w-column mx-auto flex w-full flex-1 flex-col gap-4 px-4 pt-4 pb-8">
        {children}
      </div>

      <div className="border-border border-t">
        <div
          className={cn(
            "max-w-column mx-auto flex w-full gap-2.5 px-4 lg:justify-end",
            BAR_PADDING_CLASS,
          )}
        >
          {actions}
          <Skeleton className="h-11 w-full rounded-lg lg:w-40" />
        </div>
      </div>

      {aside && (
        <div className="border-border fixed inset-y-0 right-0 hidden w-88 flex-col gap-4 border-l px-6 lg:flex xl:w-104">
          <div className="flex h-13 shrink-0 items-center xl:h-15">
            <Skeleton className="h-3 w-28" />
          </div>
          {aside}
        </div>
      )}
    </main>
  );
}
