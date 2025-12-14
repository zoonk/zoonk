import { useCallback, useState } from "react";

type UseWizardOptions<T extends string> = {
  steps: readonly T[];
  initialStep?: number;
};

type UseWizardReturn<T extends string> = {
  currentStep: number;
  currentStepName: T;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToNext: () => void;
  goToPrevious: () => void;
  goToStep: (step: number) => void;
  totalSteps: number;
};

export function useWizard<T extends string>({
  steps,
  initialStep = 0,
}: UseWizardOptions<T>): UseWizardReturn<T> {
  const [currentStep, setCurrentStep] = useState(initialStep);

  const currentStepName = steps[currentStep] as T;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const totalSteps = steps.length;

  const goToNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const goToPrevious = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, steps.length - 1)));
    },
    [steps.length],
  );

  return {
    currentStep,
    currentStepName,
    goToNext,
    goToPrevious,
    goToStep,
    isFirstStep,
    isLastStep,
    totalSteps,
  };
}
