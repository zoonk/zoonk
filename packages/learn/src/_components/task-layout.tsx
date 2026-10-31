import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { PageSectionTitle } from "./page";

export const TASK_COLUMN_CLASS = "max-w-column mx-auto w-full px-4";

const TASK_BAR_ROW_CLASS = cn(TASK_COLUMN_CLASS, "lg:max-w-none lg:px-6");

export function TaskBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(TASK_COLUMN_CLASS, "flex flex-1 flex-col gap-6 pt-4 pb-8", className)}
      data-slot="task-body"
      {...props}
    />
  );
}

export const TASK_HEADER_BAR_CLASS = "flex w-full items-center gap-2 px-4 py-2 lg:px-6 xl:py-3";

export const TASK_HEADER_SIDE_CLASS = {
  end: "flex min-w-9 flex-1 basis-0 justify-end",
  start: "flex min-w-9 flex-1 basis-0 justify-start",
} as const;

const BAR_PADDING_CLASS = "pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]";

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

export function TaskActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full items-center gap-2.5 lg:justify-end", className)}
      data-slot="task-actions"
      {...props}
    />
  );
}

/** Not `flex-1`: a zero basis would squeeze its 44px height to its label's in a column. */
export const TASK_MAIN_ACTION_CLASS =
  "w-full min-w-0 shrink grow lg:w-auto lg:min-w-40 lg:shrink-0 lg:grow-0";

export const TASK_OPTION_CLASS = "w-full lg:w-auto";

export const TASK_BACK_ACTION_CLASS = "size-11 shrink-0 lg:mr-auto";

export type TaskAsideWidth = "default" | "half";

const ASIDE_WIDTH_CLASS: Record<TaskAsideWidth, string> = {
  default: "lg:[--task-aside:18.75rem] xl:[--task-aside:20rem]",
  half: "lg:[--task-aside:min(40rem,50%)]",
};

/**
 * `--task-bar` is the header row's height (36px buttons in `py-2`, `py-3` from `xl`) and
 * `--task-aside-bottom` the action bar's row (73px), or the buddy's dock when it's taller.
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

const TASK_ASIDE_RAIL_CLASS =
  "border-border lg:fixed lg:inset-y-0 lg:right-0 lg:w-(--task-aside) lg:border-l";

export const TASK_ASIDE_PLACE_CLASS = "lg:fixed lg:right-0 lg:w-[calc(var(--task-aside)-1px)]";

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
        <p className="text-muted-foreground ml-auto shrink-0 font-mono text-xs tabular-nums empty:hidden">
          {meta}
        </p>
      )}
    </div>
  );
}

export function TaskAside({
  children,
  footer,
  label,
  meta,
  title,
}: {
  children?: React.ReactNode;
  footer?: React.ReactNode;
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

/** Nothing between it and the task's root may set a transform, which would hold it in place. */
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
      {title && <PageSectionTitle>{title}</PageSectionTitle>}
      {children}
    </section>
  );
}

export function TaskSkeleton({
  actions,
  aside,
  children,
  menu = false,
  progress = false,
  title,
}: {
  actions?: React.ReactNode;
  /** `true` keeps an empty aside until the screen arrives. */
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
