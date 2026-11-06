"use client";

import { Button } from "@zoonk/ui/components/button";
import { HelpCircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef } from "react";

/** For the answers' wrapper: once "Show the answers" reveals them, focus moves to the first. */
export function useFocusAnswersOnReveal(reading: boolean) {
  const answers = useRef<HTMLDivElement>(null);
  const wasReading = useRef(reading);

  useEffect(() => {
    if (wasReading.current && !reading) {
      answers.current?.querySelector<HTMLElement>("button:enabled, input")?.focus();
    }

    wasReading.current = reading;
  }, [reading]);

  return answers;
}

export function NotSureButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label?: string;
  onClick: () => void;
}) {
  const t = useExtracted();

  return (
    <Button disabled={disabled} focusableWhenDisabled onClick={onClick} size="lg" variant="outline">
      <HelpCircleIcon aria-hidden="true" />
      {label ?? t("I'm not sure")}
    </Button>
  );
}
