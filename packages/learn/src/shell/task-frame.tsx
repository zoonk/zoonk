"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useEnterKey, useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import {
  TASK_HEADER_ICON_CLASS,
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderProgress,
  TaskHeaderSegments,
  TaskHeaderSide,
  type TaskSegment,
} from "../_components/task-header";
import {
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskAside,
  type TaskAsideWidth,
  TaskBody,
  getTaskAsideRootProps,
} from "../_components/task-layout";
import { LearnLink } from "../learn-link";
import { goBackToApp } from "./app-history";
import { type TaskExitConfirmation } from "./task-exit-dialog";

/** Only a screen with work to lose asks before leaving, so the question's dialog is loaded then. */
const exitDialog = createOnDemand(() => import("./task-exit-dialog"));

function TaskCloseLink({
  beforeExit,
  closeOnEscape,
  confirmExit,
  href,
  toApp,
}: {
  beforeExit?: () => Promise<unknown> | null;
  closeOnEscape: boolean;
  confirmExit?: TaskExitConfirmation | null;
  href: string | null;
  toApp: boolean;
}) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLAnchorElement>({ enabled: closeOnEscape });
  const [confirming, setConfirming] = useState(false);
  // Once the learner chose to leave (or the saves were waited for), the link's next click leaves.
  const leaving = useRef(false);
  const dialog = exitDialog.useModule({ enabled: Boolean(confirmExit) });

  if (!href) {
    return <span aria-hidden="true" className="size-9 shrink-0" />;
  }

  const leave = (link: HTMLAnchorElement | null) => {
    leaving.current = true;
    link?.click();
  };

  // A task opened from several pages leaves for the one it was opened from, as it was. Work still
  // being saved finishes first: the same link is followed once it has. Unsent work asks first.
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (!isPlainClick) {
      return;
    }

    if (confirmExit && !leaving.current) {
      event.preventDefault();
      // Asks as soon as the dialog's code is here (a load that failed is tried again).
      void exitDialog.load();
      setConfirming(true);
      return;
    }

    const saving = leaving.current ? null : beforeExit?.();

    if (saving) {
      event.preventDefault();
      const link = event.currentTarget;
      void saving.finally(() => leave(link));
      return;
    }

    if (toApp && goBackToApp()) {
      event.preventDefault();
    }
  };

  return (
    <>
      <LearnLink
        className={cn(
          buttonVariants({ size: "icon", variant: "ghost" }),
          "shrink-0",
          TASK_HEADER_ICON_CLASS.start,
        )}
        href={href}
        onClick={onClick}
        ref={ref}
      >
        <XIcon aria-hidden="true" />
        <span className="sr-only">{t("Leave")}</span>
      </LearnLink>

      {confirmExit && dialog && (
        <dialog.TaskExitDialog
          confirmation={confirmExit}
          onLeave={() => {
            setConfirming(false);
            leave(ref.current);
          }}
          onOpenChange={setConfirming}
          open={confirming}
        />
      )}
    </>
  );
}

/**
 * What helps with a task beside it from `lg` (see `TaskAside`): its label and a quiet fact on its
 * header row, what only wide screens show there (`children`: the day's queue, the answer sheet,
 * the Trickster), and its foot level with the action bar (`footer`: Hand in). What the column
 * shows on a phone but sits beside it from `lg` (a passage several questions share, an essay's
 * prompt) moves into it with `TaskAsideContent` instead.
 */
export type TaskFrameAside = {
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Its name for screen readers. */
  label: string;
  meta?: React.ReactNode;
  title?: React.ReactNode;
  width?: TaskAsideWidth;
};

/**
 * A focused task has the whole screen, like a lesson, and every task wears the same chrome: one
 * header (leave in the window's top-left corner, an action in its top-right corner, its title
 * centered over the column with its progress under it), one column starting at the top, and its
 * actions pinned to the bottom over a hairline, at every screen size, so the main action is always
 * in the same place. From `lg` an `aside` can run at the window's right edge behind a hairline, with
 * what helps with the task, the rest centered in the room on its left. Checkpoints, mock exams,
 * essays, calls, pattern drills and results told in steps all use it.
 */
export function TaskFrame({
  aside,
  beforeExit,
  children,
  closeOnEscape = false,
  confirmExit = null,
  exitHref,
  exitToApp = false,
  fit = false,
  footer,
  headerEnd,
  headerTitle,
  progress,
}: {
  aside?: TaskFrameAside | null;
  /**
   * Work still being saved when the learner leaves (a mock's last answer): a promise the exit waits
   * for, so leaving never drops it; null when nothing is in flight.
   */
  beforeExit?: () => Promise<unknown> | null;
  children: React.ReactNode;
  /** Escape leaves too, for a screen with nothing to lose (a result); never mid-task. */
  closeOnEscape?: boolean;
  /** Leaving asks this first, while it would leave unsent work behind; null leaves at once. */
  confirmExit?: TaskExitConfirmation | null;
  /** Null while leaving would lose work, such as a call being saved. */
  exitHref: string | null;
  /**
   * Leaving goes back to the app page the task was opened from (Today, the Plan, the exam),
   * when the browser has it; `exitHref` otherwise.
   */
  exitToApp?: boolean;
  /**
   * From `lg` the screen fits the window and its column scrolls inside it, so what fills the rest
   * of the column (an essay's box under its instruction) keeps what's above it in view.
   */
  fit?: boolean;
  /** The pinned action bar's content: a `TaskActions` row, with quiet lines around it. */
  footer?: React.ReactNode;
  headerEnd?: React.ReactNode;
  headerTitle?: React.ReactNode;
  /**
   * Where the learner is, from 0 to 100, as a thin bar under the header; with `segments`, one
   * segment per question instead, green or red once answered; or a bar of the task's own (`bar`),
   * like the Trickster's shield.
   */
  progress?:
    | { bar: React.ReactNode }
    | { label: string; segments?: readonly TaskSegment[]; value: number };
}) {
  const asideRoot = aside ? getTaskAsideRootProps({ width: aside.width }) : null;

  return (
    <div
      className={cn(
        "bg-background text-foreground flex min-h-dvh flex-col",
        fit && "lg:h-dvh lg:overflow-hidden",
        asideRoot?.className,
      )}
      data-aside={asideRoot?.["data-aside"]}
      data-slot="task-frame"
    >
      <TaskHeader className="bg-background sticky top-0">
        <TaskHeaderBar>
          <TaskHeaderSide align="start">
            <TaskCloseLink
              beforeExit={beforeExit}
              closeOnEscape={closeOnEscape}
              confirmExit={confirmExit}
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
        className={cn("flex flex-1 flex-col", fit && "lg:min-h-0 lg:overflow-y-auto")}
        data-slot="task-frame-body"
      >
        <TaskBody>{children}</TaskBody>
      </main>

      {footer && <TaskActionBar>{footer}</TaskActionBar>}

      {aside && (
        <TaskAside footer={aside.footer} label={aside.label} meta={aside.meta} title={aside.title}>
          {aside.children}
        </TaskAside>
      )}
    </div>
  );
}

/** A save that didn't go through, with a retry; what the learner answered stays on screen. */
export function TaskSaveError({ onRetry }: { onRetry: () => void }) {
  const t = useExtracted();

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("That didn't go through. Your answers are kept.")}{" "}
      <button className="font-semibold underline" onClick={onRetry} type="button">
        {t("Try again")}
      </button>
    </p>
  );
}

/**
 * Whether an element is drawn: a main action one screen size hides (`lg:hidden`) leaves Enter to
 * the one that size shows.
 */
function isShown(element: HTMLElement | null): boolean {
  return element !== null && element.getClientRects().length > 0;
}

/**
 * A task's one main action, in its `TaskActions` row: the bar's free width on a phone, its label's
 * from `lg`. Enter presses it while it's shown.
 */
export function TaskMainButton({
  busy = false,
  children,
  className,
  disabled = false,
  onClick,
}: {
  /** Its request is on its way: a spinner beside the label (say what's happening), not dimmed. */
  busy?: boolean;
  children: React.ReactNode;
  /** Only to show it at some screen sizes (`lg:hidden`). */
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const mounted = useIsMounted();
  const isDisabled = disabled || busy || !mounted;

  useEnterKey(() => (isShown(ref.current) ? onClick() : false), { enabled: !isDisabled });

  return (
    <Button
      aria-keyshortcuts="Enter"
      className={cn(TASK_MAIN_ACTION_CLASS, busy && "disabled:opacity-100", className)}
      disabled={isDisabled}
      onClick={onClick}
      ref={ref}
      size="xl"
    >
      {busy && <Spinner aria-hidden="true" />}
      {children}
      {!busy && <ShortcutKbd tone="inverse">⏎</ShortcutKbd>}
    </Button>
  );
}

/**
 * A link styled as a task's main action, for leaving it once it's done. Enter follows it while
 * it's shown. A task opened from several pages (`toApp`) goes back to the one it was opened from,
 * as the ✕ does.
 */
export function TaskMainLink({
  children,
  className,
  href,
  toApp = false,
}: {
  children: React.ReactNode;
  /** Only to show it at some screen sizes (`max-lg:hidden`). */
  className?: string;
  href: string;
  toApp?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEnterKey(() => (isShown(ref.current) ? ref.current?.click() : false));

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (toApp && isPlainClick && goBackToApp()) {
      event.preventDefault();
    }
  };

  return (
    <LearnLink
      aria-keyshortcuts="Enter"
      className={cn(buttonVariants({ size: "xl" }), TASK_MAIN_ACTION_CLASS, className)}
      href={href}
      onClick={onClick}
      ref={ref}
    >
      {children}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}
