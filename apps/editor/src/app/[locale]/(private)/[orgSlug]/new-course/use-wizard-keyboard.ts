"use client";

import { useEffect } from "react";

type UseWizardKeyboardOptions = {
  currentStepName: string;
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

/**
 * Hook to handle global keyboard navigation for the wizard.
 * - Escape: Close the wizard
 * - Arrow Left/Right: Navigate between steps (except on language step)
 * - Enter: Proceed to next step or submit (except on description step)
 */
export function useWizardKeyboard({
  currentStepName,
  isFirstStep,
  isLastStep,
  canProceed,
  onClose,
  onBack,
  onNext,
  onSubmit,
}: UseWizardKeyboardOptions) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    function handleArrowNavigation(event: KeyboardEvent) {
      // Language step uses arrows for selection, skip navigation
      if (currentStepName === "language") {
        return;
      }

      if (event.key === "ArrowLeft" && !isFirstStep) {
        event.preventDefault();
        onBack();
      }

      if (event.key === "ArrowRight" && canProceed && !isLastStep) {
        event.preventDefault();
        onNext();
      }
    }

    function handleEnter(event: KeyboardEvent) {
      // Description step uses Cmd/Ctrl+Enter (handled by that step)
      if (currentStepName === "description") {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (isLastStep) {
          onSubmit();
        } else {
          onNext();
        }
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      handleEscape(event);
      handleArrowNavigation(event);
      handleEnter(event);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canProceed,
    currentStepName,
    isFirstStep,
    isLastStep,
    onBack,
    onClose,
    onNext,
    onSubmit,
  ]);
}
