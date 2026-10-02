"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Progress } from "@zoonk/ui/components/progress";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterClick, useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { LearnLink } from "../learn-link";

function TaskCloseLink({ href }: { href: string | null }) {
  const t = useExtracted();

  if (!href) {
    return <span aria-hidden="true" className="size-9 shrink-0" />;
  }

  return (
    <LearnLink
      className={cn(
        buttonVariants({ size: "icon", variant: "ghost" }),
        "in-data-[mode=fun]:fun-glass shrink-0",
      )}
      href={href}
    >
      <XIcon aria-hidden="true" />
      <span className="sr-only">{t("Leave")}</span>
    </LearnLink>
  );
}

/**
 * A focused task has the whole screen, like a lesson: leave on the left, context in the middle
 * and on the right, one column and one main action at the bottom. Fun paints deep space.
 * Checkpoints, mock exams, essays, calls and pattern drills all use it.
 */
export function TaskFrame({
  children,
  exitHref,
  footer,
  headerEnd,
  headerTitle,
  progress,
}: {
  children: React.ReactNode;
  /** Null while leaving would lose work, such as a call being saved. */
  exitHref: string | null;
  footer?: React.ReactNode;
  headerEnd?: React.ReactNode;
  headerTitle?: React.ReactNode;
  /** Where the learner is, from 0 to 100, as a thin bar under the header. */
  progress?: { label: string; value: number };
}) {
  const locale = useLocale();

  return (
    <div
      className="bg-background text-foreground in-data-[mode=fun]:fun-space flex min-h-dvh flex-col"
      data-slot="task-frame"
    >
      <header className="mx-auto flex w-full max-w-xl flex-col gap-2 px-3 pt-3 pb-2 sm:px-4">
        <div className="flex items-center gap-2">
          <TaskCloseLink href={exitHref} />
          <div className="text-muted-foreground min-w-0 flex-1 truncate text-center text-sm">
            {headerTitle}
          </div>
          <div className="flex min-w-9 justify-end">{headerEnd}</div>
        </div>

        {progress && (
          <Progress
            locale={locale}
            aria-label={progress.label}
            className="**:data-[slot=progress-track]:h-1"
            value={progress.value}
          />
        )}
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 pt-2 pb-6">
        {children}
      </main>

      {footer && (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
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

/** A task's one main action: the lime pill in Fun, the primary button in Focus. Enter presses it. */
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
  const variant = usePrimaryVariant();
  const isDisabled = disabled || busy;

  useEnterKey(onClick, { enabled: !isDisabled });

  return (
    <Button
      className={cn("w-full", busy && "disabled:opacity-100")}
      disabled={isDisabled}
      onClick={onClick}
      size="xl"
      variant={variant}
    >
      {busy && <Spinner aria-hidden="true" />}
      {children}
    </Button>
  );
}

/** A link styled as a task's main action, for leaving it once it's done. Enter follows it. */
export function TaskMainLink({ children, href }: { children: React.ReactNode; href: string }) {
  const variant = usePrimaryVariant();
  const ref = useEnterClick<HTMLAnchorElement>();

  return (
    <LearnLink
      className={cn(buttonVariants({ size: "xl", variant }), "w-full")}
      href={href}
      ref={ref}
    >
      {children}
    </LearnLink>
  );
}
