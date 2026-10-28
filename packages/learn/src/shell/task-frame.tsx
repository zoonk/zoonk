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
import { useSteady } from "../_utils/use-steady";
import { LearnLink } from "../learn-link";
import { goBackToApp } from "./app-history";
import { type TaskExitConfirmation } from "./task-exit-dialog";

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
  const leaving = useRef(false);
  const dialog = exitDialog.useModule({ enabled: Boolean(confirmExit) });

  if (!href) {
    return <span aria-hidden="true" className="size-9 shrink-0" />;
  }

  const leave = (link: HTMLAnchorElement | null) => {
    leaving.current = true;
    link?.click();
  };

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

    if (!isPlainClick) {
      return;
    }

    if (confirmExit && !leaving.current) {
      event.preventDefault();
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

export type TaskFrameAside = {
  children?: React.ReactNode;
  footer?: React.ReactNode;
  label: string;
  meta?: React.ReactNode;
  title?: React.ReactNode;
  width?: TaskAsideWidth;
};

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
   * A promise for work still being saved, which leaving waits for; null when nothing is in flight.
   */
  beforeExit?: () => Promise<unknown> | null;
  children: React.ReactNode;
  /** Only for a screen with nothing to lose (a result), never mid-task. */
  closeOnEscape?: boolean;
  confirmExit?: TaskExitConfirmation | null;
  /** Null while leaving would lose work, such as a call being saved. */
  exitHref: string | null;
  exitToApp?: boolean;
  fit?: boolean;
  footer?: React.ReactNode;
  headerEnd?: React.ReactNode;
  headerTitle?: React.ReactNode;
  /** `value` is 0 to 100; `segments` draws one per question, and `bar` a bar of the task's own. */
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

/** A main action one screen size hides (`lg:hidden`) leaves Enter to the one that size shows. */
function isShown(element: HTMLElement | null): boolean {
  return element !== null && element.getClientRects().length > 0;
}

export function TaskMainButton({
  busy = false,
  children,
  className,
  disabled = false,
  onClick,
}: {
  busy?: boolean;
  children: React.ReactNode;
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

export function TaskMainLink({
  children,
  className,
  href,
  steadyMs = 0,
  toApp = false,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  steadyMs?: number;
  toApp?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const isSteady = useSteady(steadyMs);

  useEnterKey(() => (isShown(ref.current) && isSteady() ? ref.current?.click() : false));

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
