import { BottomBar } from "@zoonk/ui/components/bottom-bar";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { PageSectionTitle } from "./page";

export const TASK_COLUMN_CLASS = "max-w-column mx-auto w-full px-4";

/** A bar's buttons have the task's gutter on all four sides: 16px, and 24px from `lg`. */
const TASK_BAR_ROW_CLASS = cn(TASK_COLUMN_CLASS, "lg:max-w-none lg:p-6");

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

/**
 * A side keeps the bar's first 36 px line, so a taller middle (a clock) never moves the close
 * button, and a smaller button still centers on that line. Where the sidebar's toggle closes the
 * end side, what comes before it gives the edge up to it.
 */
export const TASK_HEADER_SIDE_CLASS = {
  end: "flex min-h-9 min-w-fit flex-1 basis-0 items-center justify-end self-start lg:group-data-aside/task:[&_.edge:not([data-slot=sidebar-toggle])]:me-0",
  start: "flex min-h-9 min-w-fit flex-1 basis-0 items-center justify-start self-start",
} as const;

/** The bar's room over and under its buttons, for a foot that sits level with it. */
export const BAR_PADDING_CLASS = "pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:py-6";

/** The kit's bottom bar on a task's column. */
export function TaskActionBar(props: Omit<React.ComponentProps<typeof BottomBar>, "className">) {
  return <BottomBar className={TASK_BAR_ROW_CLASS} {...props} />;
}

export { BottomBarActions as TaskActions } from "@zoonk/ui/components/bottom-bar";

export const TASK_WRAPPING_ACTION_CLASS =
  "h-auto min-h-11 max-w-full shrink py-2 text-center text-balance whitespace-normal";

/** A button's bare text can't shrink below its longest word, so a word wider than the whole line would spill out. */
export function TaskActionLabel({ children }: { children: React.ReactNode }) {
  return <span className="min-w-0 wrap-break-word">{children}</span>;
}

/**
 * Its longest word decides when it takes a line of its own. Not `basis-0`, which would squeeze a
 * wrapped label's height to one line in a column.
 */
export const TASK_MAIN_ACTION_CLASS = cn(
  TASK_WRAPPING_ACTION_CLASS,
  "grow basis-[min-content] lg:min-w-40 lg:shrink-0 lg:grow-0 lg:basis-auto",
);

export const TASK_OPTION_CLASS = "w-full lg:w-auto";

export const TASK_BACK_ACTION_CLASS = "size-11 shrink-0 lg:mr-auto";

export type TaskAsideWidth = "default" | "half";

const ASIDE_WIDTH_CLASS: Record<TaskAsideWidth, string> = {
  default: "lg:[--task-aside:18.75rem] xl:[--task-aside:20rem]",
  half: "lg:[--task-aside:min(40rem,50%)]",
};

/**
 * `--task-bar` is the header row's height (36px buttons in `py-2`, `py-3` from `xl`) and
 * `--task-aside-bottom` the action bar's row (93px), or the buddy's dock when it's taller.
 * Lay out what depends on the aside with the `with-aside` and `without-aside` variants, not `lg`:
 * once the learner collapses it from the header (`TaskHeaderSide`), the task lays out as below `lg`.
 */
export function getTaskAsideRootProps({ width = "default" }: { width?: TaskAsideWidth } = {}) {
  return {
    className: cn(
      "group/task with-aside:pr-(--task-aside)",
      "lg:[--task-aside-bottom:max(5.8125rem,var(--task-dock,0px))] lg:[--task-bar:3.25rem] xl:[--task-bar:3.75rem]",
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
  titleId,
}: {
  className?: string;
  meta?: React.ReactNode;
  title?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-13 shrink-0 items-center justify-between gap-3 px-6 xl:h-15",
        className,
      )}
      data-slot="task-aside-header"
    >
      {title && (
        <h2 className="text-label min-w-0 truncate" id={titleId}>
          {title}
        </h2>
      )}
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
  scrollsByKeyboard = false,
  title,
}: {
  children?: React.ReactNode;
  footer?: React.ReactNode;
  label: string;
  meta?: React.ReactNode;
  scrollsByKeyboard?: boolean;
  title?: React.ReactNode;
}) {
  const titleId = useId();

  return (
    <aside
      aria-label={label}
      className={cn(
        "bg-background with-aside:flex with-aside:flex-col with-aside:pb-(--task-aside-bottom) hidden",
        TASK_ASIDE_RAIL_CLASS,
      )}
      data-slot="task-aside"
    >
      <TaskAsideHeader meta={meta} title={title} titleId={titleId} />

      <div
        aria-labelledby={scrollsByKeyboard ? titleId : undefined}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-6 pb-6",
          scrollsByKeyboard &&
            "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] focus-visible:ring-inset",
        )}
        data-slot="task-aside-body"
        role={scrollsByKeyboard ? "region" : undefined}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WebKit scrolls a container by keyboard only when it takes focus (https://bugs.webkit.org/show_bug.cgi?id=277290).
        tabIndex={scrollsByKeyboard ? 0 : undefined}
      >
        {children}
      </div>

      {footer && (
        <div
          className={cn(
            "bg-background flex flex-col gap-2 px-6 lg:bottom-0",
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
 * Nothing between it and the task's root may set a transform, which would hold it in place. Its top
 * padding is the body's plus the header's hairline, so both columns start on one line.
 */
export function TaskAsideContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "with-aside:group-data-aside/task:scroll-fade-b with-aside:top-(--task-bar) with-aside:right-0 with-aside:bottom-(--task-aside-bottom) with-aside:w-[calc(var(--task-aside)-1px)] with-aside:group-has-data-[slot$=docked-conversation]/task:invisible with-aside:group-data-aside/task:fixed with-aside:group-data-aside/task:z-30 with-aside:group-data-aside/task:overflow-y-auto with-aside:group-data-aside/task:px-6 with-aside:group-data-aside/task:pt-[calc(--spacing(4)+1px)] with-aside:group-data-aside/task:pb-6",
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

const USUAL_OPTIONS = 4;

/** A question while it loads: its title and its options, on the gaps the real ones keep. */
export function QuestionSkeleton({ options = USUAL_OPTIONS }: { options?: number }) {
  return (
    <>
      <Skeleton className="h-7 w-5/6" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: options }, (_, index) => (
          <Skeleton className="h-12 w-full rounded-xl" key={index} />
        ))}
      </div>
    </>
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
            <Skeleton className="-ml-3 size-11 rounded-lg lg:-ml-2.5 lg:size-10" />
          </div>
          <div className="flex min-w-0 justify-center">{title}</div>
          <div className={TASK_HEADER_SIDE_CLASS.end}>
            {menu && (
              <Skeleton
                className={cn("-mr-3 size-11 rounded-lg lg:-mr-2.5 lg:size-10", aside && "lg:mr-0")}
              />
            )}
            {aside && <Skeleton className="-mr-2.5 hidden size-10 rounded-lg lg:block" />}
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
        <div className={cn(TASK_BAR_ROW_CLASS, "flex gap-2 lg:justify-end", BAR_PADDING_CLASS)}>
          {actions}
          <Skeleton className="h-11 w-full rounded-lg lg:w-40" />
        </div>
      </div>

      {aside && (
        <div className={cn("with-aside:flex hidden flex-col gap-4 px-6", TASK_ASIDE_RAIL_CLASS)}>
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
