"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { EyeIcon, HelpCircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterButton } from "../../_components/enter-button";

/**
 * A misread is drilled by reading first: the answers stay hidden until the learner has read the
 * whole question and taps this (or presses Enter).
 */
export function ShowAnswersButton({ onReveal }: { onReveal: () => void }) {
  const t = useExtracted();

  useEnterKey(onReveal);

  return (
    <EnterButton onClick={onReveal}>
      <EyeIcon aria-hidden="true" />
      {t("I've read it. Show the answers")}
    </EnterButton>
  );
}

/**
 * The honest way out of a guess: saying so. It counts as a miss that comes back, never as a lucky
 * guess. Placement questions label it "I don't know yet".
 */
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
    <Button
      className="in-data-[mode=fun]:fun-glass h-12 rounded-full"
      disabled={disabled}
      onClick={onClick}
      size="lg"
      variant="outline"
    >
      <HelpCircleIcon aria-hidden="true" />
      {label ?? t("I'm not sure")}
    </Button>
  );
}
