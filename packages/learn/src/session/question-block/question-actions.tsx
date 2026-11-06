"use client";

import { ignoreHeldEnter, useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { EyeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";
import { EnterButton } from "../../_components/enter-button";
import { useFocusOnRemovedControl } from "../../_components/suggestion-focus";
import { TaskActions } from "../../_components/task-layout";

const QUESTION_MAIN_ID = "question-main-action";

/**
 * One button turns from "Show the answers" into Check and then Continue, so keyboard focus stays on
 * it through a question. Enter pressed elsewhere moves focus to it, since an answer option locks
 * while it's checked. A held Enter acts once, so it can't check and then skip the verdict.
 */
export function QuestionMainButton({
  action,
  busy = false,
  disabled = false,
  onPress,
}: {
  action: "check" | "continue" | "reveal";
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useExtracted();
  const ref = useRef<HTMLButtonElement>(null);
  const ready = !disabled && !busy;

  useEnterKey(
    () => {
      ref.current?.focus();
      onPress();
    },
    { enabled: ready },
  );

  const labels = {
    check: t("Check"),
    continue: t("Continue"),
    reveal: t("I've read it. Show the answers"),
  };

  return (
    <EnterButton
      busy={busy}
      disabled={disabled}
      id={QUESTION_MAIN_ID}
      onClick={onPress}
      onKeyDown={ignoreHeldEnter}
      ref={ref}
    >
      {action === "reveal" && <EyeIcon aria-hidden="true" />}
      {labels[action]}
    </EnterButton>
  );
}

/**
 * On a control that keeps its own Enter (a checkbox, a step, a pair), completing the answer moves
 * focus to Check, so Enter checks instead of undoing the last pick.
 */
export function useFocusCheckWhenComplete({
  complete,
  containerRef,
}: {
  complete: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (complete && containerRef.current?.contains(document.activeElement)) {
      document.querySelector<HTMLElement>(`#${QUESTION_MAIN_ID}`)?.focus();
    }
  }, [complete, containerRef]);
}

export function QuestionActionsRow({
  ask,
  children,
}: {
  ask: React.ReactNode;
  children: React.ReactNode;
}) {
  const row = useRef<HTMLDivElement>(null);

  useFocusOnRemovedControl(row, () => document.querySelector<HTMLElement>(`#${QUESTION_MAIN_ID}`));

  return (
    <TaskActions ref={row}>
      {children}
      {ask}
    </TaskActions>
  );
}
