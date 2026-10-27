"use client";

import { Spinner } from "@zoonk/ui/components/spinner";
import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { EnterButton } from "../../_components/enter-button";
import { TaskActions } from "../../_components/task-layout";

/** The Check button's id, so a question can hand it the focus once its answer is complete. */
const QUESTION_CHECK_ID = "question-check";

/**
 * Check, the question's main action in its pinned bar: it sends the answer once it's complete
 * (a pick, every step placed, every pair matched, something typed), and Enter does the same. While
 * the grade is on its way it stays put with a spinner, so nothing jumps.
 */
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

/** Continue, once the grade shows: on to the next question (or Enter). */
export function ContinueButton({ onContinue }: { onContinue: () => void }) {
  const t = useExtracted();

  useEnterKey(onContinue);

  return <EnterButton onClick={onContinue}>{t("Continue")}</EnterButton>;
}

/**
 * Once the last pick that completes an answer is made on a control that keeps its own Enter (a
 * checkbox, a step, a pair), the focus moves to Check, so Enter checks instead of undoing that
 * last pick.
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
      document.querySelector<HTMLElement>(`#${QUESTION_CHECK_ID}`)?.focus();
    }
  }, [complete, containerRef]);
}

/**
 * A question's actions in the pinned bar with the learner's buddy after them, where the lesson
 * places it: an icon, saying its name after a miss, when asking helps most (`TutorAskButton`). From
 * `lg` the buddy is in the aside instead.
 */
export function QuestionActionsRow({
  ask,
  children,
}: {
  /** "Ask {buddy}", when the host has one (`QuestionTutor.button`). */
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
