"use client";

import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { EnterButton } from "../../_components/enter-button";
import { TaskActions } from "../../_components/task-layout";

const QUESTION_CHECK_ID = "question-check";

export function CheckButton({
  busy = false,
  disabled,
  onCheck,
}: {
  busy?: boolean;
  disabled: boolean;
  onCheck: () => void;
}) {
  const t = useExtracted();

  useEnterKey(onCheck, { enabled: !disabled && !busy });

  return (
    <EnterButton disabled={disabled || busy} id={QUESTION_CHECK_ID} onClick={onCheck}>
      {busy && <Spinner aria-hidden="true" />}
      {t("Check")}
    </EnterButton>
  );
}

export function ContinueButton({ onContinue }: { onContinue: () => void }) {
  const t = useExtracted();

  useEnterKey(onContinue);

  return <EnterButton onClick={onContinue}>{t("Continue")}</EnterButton>;
}

/** On a control that keeps its own Enter (a checkbox, a step, a pair), completing the answer moves focus to Check, so Enter checks instead of undoing the last pick. */
export function useFocusCheckWhenComplete({
  complete,
  containerRef,
}: {
  complete: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (complete && containerRef.current?.contains(document.activeElement)) {
      document.querySelector<HTMLElement>(`#${QUESTION_CHECK_ID}`)?.focus();
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
  return (
    <TaskActions>
      {children}
      {ask}
    </TaskActions>
  );
}
