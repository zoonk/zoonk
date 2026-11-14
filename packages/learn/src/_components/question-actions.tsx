"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutTooltip } from "@zoonk/ui/components/shortcut-tooltip";
import { ignoreHeldEnter } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon, HelpCircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { EnterButton } from "./enter-button";
import { useHasPlacedMainAction } from "./main-action-slot";
import { useFocusOnRemovedControl } from "./suggestion-focus";
import { TASK_BACK_ACTION_CLASS, TaskActionLabel, TaskActions } from "./task-layout";

const QUESTION_MAIN_ACTION_ID = "question-main-action";

export type QuestionAction =
  | "check"
  | "confirm"
  | "continue"
  | "finish"
  | "next"
  | "nextStep"
  | "seeAnswer"
  | "seeResult"
  | "start";

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

  // A recording's Record and Stop are drawn into the row from the step, so the row reads them to
  // render again, and recover focus, when Stop leaves. The main action is whatever Enter presses.
  useHasPlacedMainAction();

  useFocusOnRemovedControl(
    row,
    () => row.current?.querySelector<HTMLElement>("[data-enter]") ?? null,
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

/** A task's way back one screen (←), at the start of its bar; `label` names what it goes back to. */
export function QuestionBack({
  className,
  label,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children" | "size" | "variant"> & {
  label?: string;
}) {
  const t = useExtracted();
  const name = label ?? t("Previous screen");

  return (
    <ShortcutTooltip align="start" label={name} shortcut="previous" side="top">
      <Button
        aria-keyshortcuts={shortcutKeys("previous")}
        className={cn(TASK_BACK_ACTION_CLASS, className)}
        data-slot="question-back"
        size="icon"
        variant="outline"
        {...props}
      >
        <ChevronLeftIcon aria-hidden="true" />
        <span className="sr-only">{name}</span>
      </Button>
    </ShortcutTooltip>
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
 * `enter` is `EnterButton`'s: `host` when the screen binds Enter itself, `off` when Enter must not
 * press it (handing in).
 */
export function QuestionMainAction({
  action,
  busy = false,
  children,
  disabled = false,
  enter = "bound",
  id = QUESTION_MAIN_ACTION_ID,
  onPress,
  ...props
}: Omit<React.ComponentProps<typeof EnterButton>, "size"> & {
  action: QuestionAction;
  onPress?: () => void;
}) {
  const label = useActionLabel(action);

  return (
    <EnterButton
      busy={busy}
      data-slot="question-main-action"
      disabled={disabled}
      enter={enter}
      id={id}
      onClick={onPress}
      onKeyDown={ignoreHeldEnter}
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
