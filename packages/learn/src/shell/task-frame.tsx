"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterClick, useEnterKey, useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderProgress,
  TaskHeaderSide,
} from "../_components/task-header";
import { LearnLink } from "../learn-link";
import { goBackToApp } from "./app-history";

function TaskCloseLink({
  closeOnEscape,
  href,
  toApp,
}: {
  closeOnEscape: boolean;
  href: string | null;
  toApp: boolean;
}) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLAnchorElement>({ enabled: closeOnEscape });

  if (!href) {
    return <span aria-hidden="true" className="size-9 shrink-0" />;
  }

  // A task opened from several pages leaves for the one it was opened from, as it was.
  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (toApp && isPlainClick && goBackToApp()) {
      event.preventDefault();
    }
  };

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "shrink-0")}
      href={href}
      onClick={onClick}
      ref={ref}
    >
      <XIcon aria-hidden="true" />
      <span className="sr-only">{t("Leave")}</span>
    </LearnLink>
  );
}

/**
 * A focused task has the whole screen, like a lesson: the same header as every full-screen task
 * (leave on the left, its title in the middle, an action on the right, one thin bar under it), one
 * column and one main action. On phones the action sits at the bottom, where the thumb is; on wide
 * screens the content and its action stay together as one group in the middle, instead of the
 * action floating at the bottom of an empty viewport. Checkpoints, mock exams, essays, calls and
 * pattern drills all use it.
 */
export function TaskFrame({
  children,
  closeOnEscape = false,
  exitHref,
  exitToApp = false,
  footer,
  headerEnd,
  headerTitle,
  progress,
}: {
  children: React.ReactNode;
  /** Escape leaves too, for a screen with nothing to lose (a result); never mid-task. */
  closeOnEscape?: boolean;
  /** Null while leaving would lose work, such as a call being saved. */
  exitHref: string | null;
  /**
   * Leaving goes back to the app page the task was opened from (Today, the Journey, the exam),
   * when the browser has it; `exitHref` otherwise.
   */
  exitToApp?: boolean;
  footer?: React.ReactNode;
  headerEnd?: React.ReactNode;
  headerTitle?: React.ReactNode;
  /** Where the learner is, from 0 to 100, as a thin bar under the header. */
  progress?: { label: string; value: number };
}) {
  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col" data-slot="task-frame">
      <TaskHeader>
        <TaskHeaderBar>
          <TaskHeaderSide align="start">
            <TaskCloseLink closeOnEscape={closeOnEscape} href={exitHref} toApp={exitToApp} />
          </TaskHeaderSide>
          <div className="text-muted-foreground flex min-w-0 shrink justify-center text-center text-sm text-balance">
            {headerTitle}
          </div>
          <TaskHeaderSide align="end">{headerEnd}</TaskHeaderSide>
        </TaskHeaderBar>

        {progress && <TaskHeaderProgress label={progress.label} value={progress.value} />}
      </TaskHeader>

      <div
        className="flex flex-1 flex-col lg:justify-center-safe lg:py-10"
        data-slot="task-frame-body"
      >
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-2 pb-6 lg:flex-none">
          {children}
        </main>

        {footer && (
          <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** A save that didn't go through, with a retry; what the learner answered stays on screen. */
export function TaskSaveError({ onRetry }: { onRetry: () => void }) {
  const t = useExtracted();

  return (
    <p className="text-destructive text-center text-sm" role="alert">
      {t("That didn't go through. Your answers are kept.")}{" "}
      <button className="font-semibold underline" onClick={onRetry} type="button">
        {t("Try again")}
      </button>
    </p>
  );
}

/** A task's one main action. Enter presses it. */
export function TaskMainButton({
  busy = false,
  children,
  disabled = false,
  onClick,
}: {
  /** Its request is on its way: a spinner beside the label (say what's happening), not dimmed. */
  busy?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isDisabled = disabled || busy;

  useEnterKey(onClick, { enabled: !isDisabled });

  return (
    <Button
      className={cn("w-full", busy && "disabled:opacity-100")}
      disabled={isDisabled}
      onClick={onClick}
      size="xl"
    >
      {busy && <Spinner aria-hidden="true" />}
      {children}
    </Button>
  );
}

/** A link styled as a task's main action, for leaving it once it's done. Enter follows it. */
export function TaskMainLink({ children, href }: { children: React.ReactNode; href: string }) {
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink className={cn(buttonVariants({ size: "xl" }), "w-full")} href={href} ref={ref}>
      {children}
    </LearnLink>
  );
}
