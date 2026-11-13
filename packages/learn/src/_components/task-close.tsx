"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutTooltip } from "@zoonk/ui/components/shortcut-tooltip";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { createOnDemand } from "@zoonk/ui/lib/on-demand";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { LearnLink } from "../learn-link";
import { goBackTo, goBackToApp } from "../shell/app-history";
import { type TaskExitConfirmation } from "../shell/task-exit-dialog";

const exitDialog = createOnDemand(() => import("../shell/task-exit-dialog"));

type CloseLinkProps = {
  "aria-keyshortcuts"?: string;
  children: React.ReactNode;
  className?: string;
  href: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
  ref?: React.Ref<HTMLAnchorElement>;
};

function isPlainClick(event: React.MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** A bar's bare glyph is 20px (craft I2). */
const CLOSE_CLASS = "shrink-0 [--icon-size:--spacing(5)]";

/**
 * A full-screen task's ✕, and Esc with it: the key presses the ✕, so both ask the same question
 * first (`confirm`), wait for the same saves (`beforeExit`) and land on the same page. It goes back
 * in history when the page before is the one it names, so the browser's own back button doesn't
 * return to a task the learner left.
 */
export function TaskClose({
  beforeExit,
  className,
  confirm = null,
  disabled = false,
  escHeld = false,
  href,
  label,
  link: Link = LearnLink,
  onPress,
  prefetch,
  size = "icon",
  toApp = false,
}: {
  /** A promise for work still being saved, which leaving waits for; null when nothing is in flight. */
  beforeExit?: () => Promise<unknown> | null;
  className?: string;
  /** Asked first, by the ✕ and by Esc, while leaving would lose something. */
  confirm?: TaskExitConfirmation | null;
  disabled?: boolean;
  /** True while Esc belongs to something the screen itself opened, such as a docked panel. */
  escHeld?: boolean;
  /** Null while leaving would lose work that is being saved; the ✕ keeps its room. */
  href?: string | null;
  /** Only when leaving promises something: "Leave. Your answers are saved." */
  label?: string;
  /** The host's link, where the task runs outside the app's frame. */
  link?: React.ComponentType<CloseLinkProps> | ((props: CloseLinkProps) => React.ReactNode);
  /** Ends the task itself instead of going to a page. */
  onPress?: () => void;
  prefetch?: boolean;
  size?: "icon" | "icon-bar";
  /** Goes back to the app page the learner came from, wherever that was. */
  toApp?: boolean;
}) {
  const t = useExtracted();
  const linkRef = useEscapeClick<HTMLAnchorElement>({ enabled: !escHeld });
  const buttonRef = useEscapeClick<HTMLButtonElement>({ enabled: !escHeld });
  const [asking, setAsking] = useState(false);
  const dialog = exitDialog.useModule({ enabled: Boolean(confirm) });

  // What the click that presses itself again has already done: asked, or asked and saved.
  const done = useRef<"asked" | "saved" | null>(null);

  const pressAgain = (stage: "asked" | "saved") => {
    done.current = stage;
    (linkRef.current ?? buttonRef.current)?.click();
  };

  const asksFirst = () => {
    if (!confirm || done.current) {
      return false;
    }

    void exitDialog.load();
    setAsking(true);
    return true;
  };

  const onLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) {
      return;
    }

    const asked = asksFirst();
    const saving = asked || done.current === "saved" ? null : beforeExit?.();
    done.current = null;

    if (asked) {
      event.preventDefault();
      return;
    }

    if (saving) {
      event.preventDefault();
      void saving.finally(() => pressAgain("saved"));
      return;
    }

    if (goBackTo(event.currentTarget.href) || (toApp && goBackToApp())) {
      event.preventDefault();
    }
  };

  const onButtonClick = () => {
    const asked = asksFirst();
    done.current = null;

    if (!asked) {
      onPress?.();
    }
  };

  const shared = { "aria-keyshortcuts": shortcutKeys("leave"), "data-slot": "task-close" } as const;

  const content = (
    <>
      <XIcon aria-hidden="true" />
      <span className="sr-only">{label ?? t("Leave")}</span>
    </>
  );

  const ask = confirm && dialog && (
    <dialog.TaskExitDialog
      confirmation={confirm}
      onLeave={() => {
        setAsking(false);
        pressAgain("asked");
      }}
      onOpenChange={setAsking}
      open={asking}
    />
  );

  const tooltip = (control: React.ReactElement) => (
    <ShortcutTooltip align="start" label={label ?? t("Leave")} shortcut="leave">
      {control}
    </ShortcutTooltip>
  );

  if (onPress) {
    return (
      <>
        {tooltip(
          <Button
            {...shared}
            className={cn(CLOSE_CLASS, className)}
            disabled={disabled}
            edge="start"
            focusableWhenDisabled
            onClick={onButtonClick}
            ref={buttonRef}
            size={size}
            variant="ghost"
          >
            {content}
          </Button>,
        )}
        {ask}
      </>
    );
  }

  if (!href) {
    return <span aria-hidden="true" className="size-9 shrink-0" />;
  }

  return (
    <>
      {tooltip(
        <Link
          {...shared}
          className={cn(
            buttonVariants({ edge: "start", size, variant: "ghost" }),
            CLOSE_CLASS,
            className,
          )}
          href={href}
          onClick={onLinkClick}
          prefetch={prefetch}
          ref={linkRef}
        >
          {content}
        </Link>,
      )}
      {ask}
    </>
  );
}
