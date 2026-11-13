"use client";

import { type NoGlyph } from "@zoonk/ui/components/enter-button";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { cn } from "@zoonk/ui/lib/utils";
import { useRef } from "react";
import { EnterButton, EnterLink } from "../_components/enter-button";
import { useFocusOnRemovedControl } from "../_components/suggestion-focus";
import { TaskClose } from "../_components/task-close";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderProgress,
  TaskHeaderSegments,
  TaskHeaderSide,
  type TaskSegment,
} from "../_components/task-header";
import {
  TaskActionBar,
  TaskAside,
  type TaskAsideWidth,
  TaskBody,
  getTaskAsideRootProps,
} from "../_components/task-layout";
import { useSteady } from "../_utils/use-steady";
import { goBackToApp } from "./app-history";
import { type TaskExitConfirmation } from "./task-exit-dialog";

export type TaskFrameAside = {
  children?: React.ReactNode;
  footer?: React.ReactNode;
  label: string;
  meta?: React.ReactNode;
  title?: React.ReactNode;
  width?: TaskAsideWidth;
};

const FIT_CLASS = {
  always: { body: "min-h-0", root: "h-dvh overflow-hidden" },
  lg: { body: "lg:min-h-0 lg:overflow-y-auto", root: "lg:h-dvh lg:overflow-hidden" },
} as const;

export function TaskFrame({
  aside,
  beforeExit,
  children,
  confirmExit = null,
  exitHref,
  exitToApp = false,
  fit,
  footer,
  headerEnd,
  headerTitle,
  progress,
}: {
  aside?: TaskFrameAside | null;
  /**
   * A promise for work still being saved, which leaving waits for; null when nothing is in flight.
   */
  beforeExit?: () => Promise<unknown> | null;
  children: React.ReactNode;
  /** Asked first, by the ✕ and by Esc, while leaving would lose something. */
  confirmExit?: TaskExitConfirmation | null;
  /** Null while leaving would lose work, such as a call being saved. */
  exitHref: string | null;
  exitToApp?: boolean;
  /**
   * `lg` keeps the frame to the window's height from `lg`, so the body scrolls between the header
   * and the bar. `always` does it at every width for a body that scrolls itself, unpadded.
   */
  fit?: "always" | "lg";
  footer?: React.ReactNode;
  headerEnd?: React.ReactNode;
  headerTitle?: React.ReactNode;
  /** `value` is 0 to 100; `segments` draws one per question, and `bar` a bar of the task's own. */
  progress?:
    | { bar: React.ReactNode }
    | { label: string; segments?: readonly TaskSegment[]; value: number };
}) {
  const asideRoot = aside ? getTaskAsideRootProps({ width: aside.width }) : null;
  const frame = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useFocusOnRemovedControl(frame, () => bar.current ?? body.current);

  return (
    <div
      className={cn(
        "bg-background text-foreground flex min-h-dvh flex-col",
        fit && FIT_CLASS[fit].root,
        asideRoot?.className,
      )}
      data-aside={asideRoot?.["data-aside"]}
      data-slot="task-frame"
      ref={frame}
    >
      <TaskHeader className="bg-background sticky top-0">
        <TaskHeaderBar>
          <TaskHeaderSide align="start">
            <TaskClose
              beforeExit={beforeExit}
              confirm={confirmExit}
              href={exitHref}
              toApp={exitToApp}
            />
          </TaskHeaderSide>
          <div className="text-foreground flex min-w-0 shrink justify-center text-center text-sm font-medium text-balance">
            {headerTitle}
          </div>
          <TaskHeaderSide align="end">{headerEnd}</TaskHeaderSide>
        </TaskHeaderBar>

        {progress && "bar" in progress && progress.bar}

        {progress && "segments" in progress && progress.segments && (
          <TaskHeaderSegments
            label={progress.label}
            segments={progress.segments}
            value={progress.value}
          />
        )}

        {progress && "value" in progress && !progress.segments && (
          <TaskHeaderProgress label={progress.label} value={progress.value} />
        )}
      </TaskHeader>

      <main
        className={cn("flex flex-1 flex-col outline-none", fit && FIT_CLASS[fit].body)}
        data-slot="task-frame-body"
        ref={body}
        tabIndex={-1}
      >
        {fit === "always" ? children : <TaskBody>{children}</TaskBody>}
      </main>

      {footer && (
        <TaskActionBar ref={bar} tabIndex={-1}>
          {footer}
        </TaskActionBar>
      )}

      {aside && (
        <TaskAside footer={aside.footer} label={aside.label} meta={aside.meta} title={aside.title}>
          {aside.children}
        </TaskAside>
      )}
    </div>
  );
}

export function TaskMainButton({
  busy = false,
  children,
  className,
  disabled = false,
  onClick,
}: NoGlyph & {
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const mounted = useIsMounted();

  return (
    <EnterButton
      busy={busy}
      className={className}
      disabled={disabled || !mounted}
      onClick={onClick}
    >
      {children}
    </EnterButton>
  );
}

export function TaskMainLink({
  children,
  className,
  href,
  steadyMs = 0,
  toApp = false,
}: NoGlyph & {
  children: React.ReactNode;
  className?: string;
  href: string;
  steadyMs?: number;
  toApp?: boolean;
}) {
  const isSteady = useSteady(steadyMs);

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isSteady()) {
      event.preventDefault();
      return;
    }

    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (toApp && isPlainClick && goBackToApp()) {
      event.preventDefault();
    }
  };

  return (
    <EnterLink className={className} href={href} onClick={onClick}>
      {children}
    </EnterLink>
  );
}
