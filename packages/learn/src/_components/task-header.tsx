"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { SidebarToggle, useSidebarOpen } from "@zoonk/ui/components/sidebar-toggle";
import { useScrolled } from "@zoonk/ui/hooks/scrolled";
import { cn } from "@zoonk/ui/lib/utils";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { EllipsisIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../_utils/locale";
import { TASK_COLUMN_CLASS, TASK_HEADER_BAR_CLASS, TASK_HEADER_SIDE_CLASS } from "./task-layout";

export function TaskHeader({ className, ...props }: React.ComponentProps<"div">) {
  const scrolled = useScrolled();

  return (
    <div
      className={cn(
        "after:from-background relative z-30 shrink-0 border-b transition-colors after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:mt-px after:h-3 after:bg-linear-to-b after:to-transparent motion-reduce:transition-none",
        scrolled ? "border-border" : "border-transparent",
        className,
      )}
      data-slot="task-header"
      {...props}
    />
  );
}

export function TaskHeaderBar({ className, ...props }: React.ComponentProps<"header">) {
  return <header className={cn(TASK_HEADER_BAR_CLASS, className)} {...props} />;
}

/** The end side offers the sidebar's toggle on a task that has one. */
export function TaskHeaderSide({
  align,
  children,
}: {
  align: "end" | "start";
  children?: React.ReactNode;
}) {
  const t = useExtracted();

  return (
    <div className={TASK_HEADER_SIDE_CLASS[align]}>
      {align === "end" && (
        <SidebarToggle
          className="hidden lg:group-data-aside/task:inline-flex"
          collapseLabel={t("Collapse sidebar")}
          expandLabel={t("Expand sidebar")}
          side="end"
        />
      )}
      {children}
    </div>
  );
}

/**
 * The bare "…" that ends a task's header, a bar or a line. `label` names the menu when it isn't
 * about the screen.
 */
export function TaskHeaderMenu({
  children,
  label,
  onOpenChange,
  size = "icon",
  ...content
}: Pick<React.ComponentProps<typeof DropdownMenuContent>, "className" | "finalFocus"> & {
  children: React.ReactNode;
  label?: string;
  onOpenChange?: (open: boolean) => void;
  size?: "icon" | "icon-bar";
}) {
  const t = useExtracted();

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<Button className="shrink-0" edge="end" size={size} variant="ghost" />}
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{label ?? t("Screen options")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" {...content}>
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
  title,
}: {
  announce?: boolean;
  detail?: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-w-0 shrink flex-col items-center text-center text-balance">
      <h1 className={TASK_TITLE_CLASS}>{title}</h1>
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
  current: "ring-success ring-1 ring-inset",
  done: "bg-success",
  read: "bg-foreground/25",
  right: "bg-success",
  wrong: "bg-destructive",
};

export function TaskHeaderSegments({
  label,
  segments,
  value,
  weights,
}: {
  label: string;
  segments: readonly TaskSegment[];
  value: number;
  weights?: readonly number[];
}) {
  const locale = useAppLocale();

  return (
    <ProgressRoot
      aria-label={label}
      className={cn(TASK_COLUMN_CLASS, "pb-1")}
      data-slot="task-header-segments"
      locale={getFormattingLocale(locale)}
      value={Math.min(100, Math.max(0, value))}
    >
      <span
        aria-hidden="true"
        className={cn("flex h-1 w-full", segments.length > DENSE_SEGMENTS ? "gap-px" : "gap-[3px]")}
      >
        {segments.map((segment, index) => (
          <span
            className={cn(
              "flex min-w-0 flex-1 overflow-hidden rounded-xs transition-colors motion-reduce:transition-none",
              SEGMENT_CLASS[segment],
            )}
            data-segment={segment}
            // oxlint-disable-next-line react/no-array-index-key -- Segments are positions, not items.
            key={index}
            style={weights ? { flexGrow: Math.max(1, weights[index] ?? 1) } : undefined}
          />
        ))}
      </span>
    </ProgressRoot>
  );
}

/** Follows the `with-aside` variant in `@zoonk/ui`'s `globals.css`; use it only for behavior. */
export function useTaskAsideShown(): boolean {
  return useSidebarOpen("end");
}
