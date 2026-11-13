"use client";

import { Button, FORWARD_ICON } from "@zoonk/ui/components/button";
import { ignoreHeldEnter, useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, ChevronLeftIcon, EyeIcon, HelpCircleIcon, PlayIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { EnterButton } from "./enter-button";
import { useFocusOnRemovedControl } from "./suggestion-focus";
import { TASK_BACK_ACTION_CLASS, TaskActionLabel, TaskActions } from "./task-layout";

export const QUESTION_MAIN_ACTION_ID = "question-main-action";

const ICONS = {
  check: { icon: <CheckIcon aria-hidden="true" /> },
  confirm: { icon: <CheckIcon aria-hidden="true" /> },
  continue: FORWARD_ICON,
  finish: FORWARD_ICON,
  next: FORWARD_ICON,
  nextStep: FORWARD_ICON,
  seeAnswer: { icon: <EyeIcon aria-hidden="true" /> },
  seeResult: FORWARD_ICON,
  start: { icon: <PlayIcon aria-hidden="true" /> },
} as const;

export type QuestionAction = keyof typeof ICONS;

function useActionLabel(action: QuestionAction): string {
  const t = useExtracted();

  const labels: Record<QuestionAction, string> = {
    check: t("Check"),
    confirm: t("Confirm"),
    continue: t("Continue"),
    finish: t("Finish"),
    next: t("Next"),
    nextStep: t("Show the next step"),
    seeAnswer: t("See the answer"),
    seeResult: t("See how it went"),
    start: t("Start"),
  };

  return labels[action];
}

/**
 * The row a question is answered from, for a frame's pinned bar (`TaskFrame`'s `footer`,
 * `TaskActionBar`, onboarding's `bar`): the way back, "I don't know yet", the main action, then
 * the screen's own extras. Focus lost with a control that left moves to the main action.
 */
export function QuestionActions({ className, ...props }: React.ComponentProps<typeof TaskActions>) {
  const row = useRef<HTMLDivElement>(null);

  useFocusOnRemovedControl(row, () =>
    document.querySelector<HTMLElement>(`#${QUESTION_MAIN_ACTION_ID}`),
  );

  return (
    <TaskActions
      // On a phone a row that also holds the way back has no room for it, so it takes the line above.
      className={cn(
        "has-data-[slot=question-back]:*:data-[slot=question-dont-know]:max-lg:order-first has-data-[slot=question-back]:*:data-[slot=question-dont-know]:max-lg:basis-full",
        className,
      )}
      data-slot="question-actions"
      ref={row}
      {...props}
    />
  );
}

export function QuestionBack({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children" | "size" | "variant">) {
  const t = useExtracted();

  return (
    <Button
      aria-keyshortcuts={shortcutKeys("previous")}
      className={cn(TASK_BACK_ACTION_CLASS, className)}
      data-slot="question-back"
      size="icon"
      variant="outline"
      {...props}
    >
      <ChevronLeftIcon aria-hidden="true" />
      <span className="sr-only">{t("Previous screen")}</span>
    </Button>
  );
}

/** `children` replaces the words where the question has its own, such as a listening question's. */
export function QuestionDontKnow({
  busy = false,
  children,
  disabled = false,
  onPress,
}: {
  busy?: boolean;
  children?: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useExtracted();

  return (
    <Button
      busy={busy}
      className="shrink-0"
      data-slot="question-dont-know"
      disabled={disabled}
      focusableWhenDisabled
      icon={<HelpCircleIcon aria-hidden="true" />}
      onClick={onPress}
      size="xl"
      variant="outline"
    >
      {children || t("I don't know yet")}
    </Button>
  );
}

/**
 * One button through a question, so keyboard focus stays on it from Check to Continue. Enter
 * pressed elsewhere moves focus to it, since an answer option locks while it's checked, and a held
 * Enter acts once, so it can't check and then skip the verdict.
 *
 * `enter`: `host` when the screen binds Enter itself, `off` when Enter must not press it (handing
 * in). The ⏎ hint shows whenever Enter works.
 */
export function QuestionMainAction({
  action,
  busy = false,
  children,
  disabled = false,
  enter = "bound",
  icon,
  id = QUESTION_MAIN_ACTION_ID,
  onPress,
  ...props
}: Omit<React.ComponentProps<typeof EnterButton>, "iconPosition" | "shortcut"> & {
  action: QuestionAction;
  enter?: "bound" | "host" | "off";
  onPress?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const label = useActionLabel(action);

  useEnterKey(
    () => {
      if (!onPress || !ref.current || ref.current.getClientRects().length === 0) {
        return false;
      }

      ref.current.focus();
      onPress();
    },
    { enabled: enter === "bound" && !disabled && !busy },
  );

  return (
    <EnterButton
      busy={busy}
      data-slot="question-main-action"
      disabled={disabled}
      id={id}
      onClick={onPress}
      onKeyDown={ignoreHeldEnter}
      ref={ref}
      shortcut={enter !== "off"}
      {...(icon ? { icon } : ICONS[action])}
      {...props}
    >
      <TaskActionLabel>{children ?? label}</TaskActionLabel>
    </EnterButton>
  );
}

/**
 * On a control that keeps its own Enter (a checkbox, a step, a pair), completing the answer moves
 * focus to the main action, so Enter checks instead of undoing the last pick.
 */
export function useFocusMainActionWhenComplete({
  complete,
  containerRef,
}: {
  complete: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (complete && containerRef.current?.contains(document.activeElement)) {
      document.querySelector<HTMLElement>(`#${QUESTION_MAIN_ACTION_ID}`)?.focus();
    }
  }, [complete, containerRef]);
}
