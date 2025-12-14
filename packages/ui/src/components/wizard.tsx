"use client";

import {
  Indicator as RadioGroupIndicator,
  Item as RadioGroupItem,
  Root as RadioGroupRoot,
} from "@radix-ui/react-radio-group";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function Wizard({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn("flex min-h-dvh flex-col", className)}
      data-slot="wizard"
      {...props}
    />
  );
}

export function WizardContent({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className="flex flex-1 flex-col items-start p-4 lg:items-center lg:justify-center lg:pt-0"
      data-slot="wizard-content"
      {...props}
    >
      <div className={cn("flex w-full max-w-xl flex-col gap-4", className)}>
        {children}
      </div>
    </section>
  );
}

export function WizardGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      data-slot="wizard-group"
      {...props}
    />
  );
}

export function WizardField({
  className,
  ...props
}: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      className={cn("flex flex-col gap-2", className)}
      data-slot="wizard-field"
      {...props}
    />
  );
}

export function WizardLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via props when used
    <label
      className={cn(
        "font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest",
        className,
      )}
      data-slot="wizard-label"
      {...props}
    />
  );
}

export function WizardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="wizard-description"
      {...props}
    />
  );
}

export function WizardError({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("min-h-5 text-destructive text-sm", className)}
      data-slot="wizard-error"
      {...props}
    />
  );
}

export function WizardInputGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-baseline gap-2", className)}
      data-slot="wizard-input-group"
      {...props}
    />
  );
}

export function WizardInputPrefix({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground", className)}
      data-slot="wizard-input-prefix"
      {...props}
    />
  );
}

export function WizardInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full border-0 bg-transparent font-bold text-3xl outline-none transition-colors placeholder:text-muted-foreground/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-slot="wizard-input"
      {...props}
    />
  );
}

export function WizardTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "field-sizing-content min-h-24 w-full resize-none border-0 bg-transparent text-xl outline-none transition-colors placeholder:text-muted-foreground/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      data-slot="wizard-textarea"
      {...props}
    />
  );
}

export function WizardRadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupRoot>) {
  return (
    <RadioGroupRoot
      className={cn("flex flex-col", className)}
      data-slot="wizard-radio-group"
      {...props}
    />
  );
}

export function WizardRadioGroupItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupItem>) {
  return (
    <RadioGroupItem
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-lg px-4 py-4 text-left font-semibold text-lg transition-colors",
        "hover:bg-muted",
        "data-[state=checked]:bg-foreground data-[state=checked]:text-background",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
      data-slot="wizard-radio-group-item"
      {...props}
    >
      {children}

      <RadioGroupIndicator data-slot="wizard-radio-group-indicator">
        <CheckIcon aria-hidden="true" className="size-5" />
      </RadioGroupIndicator>
    </RadioGroupItem>
  );
}

export function useWizard<T extends string>({
  steps,
  initialStep = 0,
}: {
  steps: readonly T[];
  initialStep?: number;
}): {
  currentStep: number;
  currentStepName: T;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToNext: () => void;
  goToPrevious: () => void;
  goToStep: (step: number) => void;
  totalSteps: number;
} {
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

/**
 * Hook to handle global keyboard navigation for the wizard.
 * - Escape: Close the wizard
 * - Arrow Left/Right: Navigate between steps (except on language step)
 * - Enter: Proceed to next step or submit (except on description step)
 */
export function useWizardKeyboard({
  isFirstStep,
  isLastStep,
  canProceed,
  onClose,
  onBack,
  onNext,
  onSubmit,
}: {
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    function handleArrowNavigation(event: KeyboardEvent) {
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
  }, [canProceed, isFirstStep, isLastStep, onBack, onClose, onNext, onSubmit]);
}
