"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import {
  SidebarToggle,
  SidebarToggleRoom,
  useSidebarOpen,
} from "@zoonk/ui/components/sidebar-toggle";
import { useScrolled } from "@zoonk/ui/hooks/scrolled";
import { cn } from "@zoonk/ui/lib/utils";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { EllipsisIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef } from "react";
import { useAppLocale } from "../_utils/locale";
import {
  TASK_ASIDE_TOGGLE_CLASS,
  TASK_ASIDE_TOGGLE_ROOM_CLASS,
  TASK_COLUMN_CLASS,
  TASK_HEADER_BAR_CLASS,
  TASK_HEADER_SIDE_CLASS,
} from "./task-layout";

export function TaskHeader({ className, ...props }: React.ComponentProps<"div">) {
  const scrolled = useScrolled();

  return (
    <div
      className={cn(
        "after:from-background relative z-40 shrink-0 border-b transition-colors after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:mt-px after:h-3 after:bg-linear-to-b after:to-transparent motion-reduce:transition-none",
        scrolled ? "border-border" : "border-transparent",
        className,
      )}
      data-slot="task-header"
      {...props}
      data-task-header=""
    />
  );
}

export function TaskHeaderBar({ className, ...props }: React.ComponentProps<"header">) {
  return <header className={cn(TASK_HEADER_BAR_CLASS, className)} {...props} />;
}

/**
 * On the end side the aside's toggle, on a task that has one, is the outermost control, with "…"
 * just inside it.
 */
export function TaskHeaderSide({
  align,
  children,
}: {
  align: "end" | "start";
  children?: React.ReactNode;
}) {
  const t = useExtracted();

  if (align === "start") {
    return <div className={TASK_HEADER_SIDE_CLASS.start}>{children}</div>;
  }

  return (
    <>
      <div className={TASK_HEADER_SIDE_CLASS.end}>
        {children}
        <SidebarToggleRoom className={TASK_ASIDE_TOGGLE_ROOM_CLASS} />
      </div>
      <div className={TASK_ASIDE_TOGGLE_CLASS}>
        <SidebarToggle
          collapseLabel={t("Collapse sidebar")}
          expandLabel={t("Expand sidebar")}
          side="end"
        />
      </div>
    </>
  );
}

export function TaskHeaderAction({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return <Button className={cn("shrink-0", className)} size="bar" variant="outline" {...props} />;
}

const MAIN_ACTION_SELECTOR = "[data-enter]:not(:disabled, [aria-disabled='true'])";

/**
 * In a task's header, a closed "…" sends focus to the task's main action when it can be pressed,
 * or to the task's body: left on "…", Enter would open the menu again when the learner means "go
 * on". Anywhere else focus returns to "…", as after every menu.
 */
function getFocusAfterMenu(trigger: HTMLElement | null): HTMLElement | true {
  if (!trigger?.closest("[data-task-header]")) {
    return true;
  }

  const main = [...document.querySelectorAll<HTMLElement>(MAIN_ACTION_SELECTOR)].find(
    (action) => action.getClientRects().length > 0,
  );

  return main ?? document.querySelector<HTMLElement>("[data-slot='task-frame-body']") ?? true;
}

/**
 * The bare "…" that ends a task's header, a bar or a line. `label` names the menu when it isn't
 * about the screen.
 */
export function TaskHeaderMenu({
  children,
  label,
  onOpenChange,
  ...content
}: Pick<React.ComponentProps<typeof DropdownMenuContent>, "className" | "finalFocus"> & {
  children: React.ReactNode;
  label?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useExtracted();
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        ref={trigger}
        render={<Button className="shrink-0" edge="end" size="icon-bar" variant="ghost" />}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{label ?? t("Screen options")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        finalFocus={() => getFocusAfterMenu(trigger.current)}
        {...content}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A task's title, wherever its header shows one: the Study view's and its zoom alike. */
export const TASK_TITLE_CLASS = "text-foreground text-sm leading-5 font-medium";

export function TaskHeaderTitle({
  announce = true,
  detail,
  spoken = false,
  title,
}: {
  announce?: boolean;
  detail?: React.ReactNode;
  /** For a screen whose body shows the same title large: only screen readers get it here. */
  spoken?: boolean;
  title: string;
}) {
  if (spoken) {
    return <h1 className="sr-only">{title}</h1>;
  }

  return (
    // One line, so a long title never moves what's under the bar.
    <div className="flex max-w-full min-w-0 flex-col items-center text-center">
      <h1 className={cn(TASK_TITLE_CLASS, "max-w-full truncate")}>{title}</h1>
      {detail && (
        <p
          aria-live={announce ? "polite" : undefined}
          className="text-muted-foreground text-2xs font-mono leading-4 tabular-nums"
        >
          {detail}
        </p>
      )}
    </div>
  );
}

export function TaskHeaderProgress({ label, value }: { label: string; value: number }) {
  const locale = useAppLocale();

  return (
    <ProgressRoot
      aria-label={label}
      className={cn(TASK_COLUMN_CLASS, "gap-0 pb-1")}
      data-slot="task-header-progress"
      locale={getFormattingLocale(locale)}
      value={Math.min(100, Math.max(0, value))}
    >
      <ProgressTrack className="bg-surface-3 h-1 rounded-xs">
        <ProgressIndicator className="bg-success rounded-xs" />
      </ProgressTrack>
    </ProgressRoot>
  );
}

export type TaskSegment = "ahead" | "current" | "done" | "read" | "right" | "wrong";

const DENSE_SEGMENTS = 40;

const SEGMENT_CLASS: Record<TaskSegment, string> = {
  ahead: "bg-surface-3",
  current: "bg-success/40",
  done: "bg-success",
  read: "bg-foreground/25",
  right: "bg-success",
  wrong: "bg-destructive",
};

function groupSegments<Item>(items: readonly Item[], groups: readonly number[] | undefined) {
  const sizes = groups && groups.length > 0 ? groups : [items.length];

  const starts = sizes.map((_, index) =>
    sizes.slice(0, index).reduce((sum, size) => sum + size, 0),
  );

  return starts
    .map((start, index) => ({ items: items.slice(start, start + (sizes[index] ?? 0)), start }))
    .filter((group) => group.items.length > 0);
}

/**
 * `done` is answered with no verdict, for a test that never says right or wrong. `groups` are the
 * sizes of the task's sections in order, drawn with a wider gap between them.
 */
export function TaskHeaderSegments({
  groups,
  label,
  segments,
  value,
  weights,
}: {
  groups?: readonly number[];
  label: string;
  segments: readonly TaskSegment[];
  value: number;
  weights?: readonly number[];
}) {
  const locale = useAppLocale();
  const gap = segments.length > DENSE_SEGMENTS ? "gap-px" : "gap-0.5";

  return (
    <ProgressRoot
      aria-label={label}
      className={cn(TASK_COLUMN_CLASS, "pb-1")}
      data-slot="task-header-segments"
      locale={getFormattingLocale(locale)}
      value={Math.min(100, Math.max(0, value))}
    >
      <span aria-hidden="true" className="flex h-1 w-full gap-1.5">
        {groupSegments(segments, groups).map((group) => (
          <span
            className={cn("flex min-w-0 basis-0", gap)}
            key={group.start}
            style={{ flexGrow: group.items.length }}
          >
            {group.items.map((segment, offset) => (
              <span
                className={cn(
                  "flex min-w-0 flex-1 overflow-hidden rounded-xs transition-colors motion-reduce:transition-none",
                  SEGMENT_CLASS[segment],
                )}
                data-segment={segment}
                // oxlint-disable-next-line react/no-array-index-key -- Segments are positions, not items.
                key={offset}
                style={
                  weights
                    ? { flexGrow: Math.max(1, weights[group.start + offset] ?? 1) }
                    : undefined
                }
              />
            ))}
          </span>
        ))}
      </span>
    </ProgressRoot>
  );
}

/** Follows the `with-aside` variant in `@zoonk/ui`'s `globals.css`; use it only for behavior. */
export function useTaskAsideShown(): boolean {
  return useSidebarOpen("end");
}
