"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { EyeIcon, HelpCircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterButton } from "../../_components/enter-button";

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

export function NotSureButton({
  busy,
  disabled,
  label,
  onClick,
}: {
  busy?: boolean;
  disabled: boolean;
  label?: string;
  onClick: () => void;
}) {
  const t = useExtracted();

  return (
    <Button
      busy={busy}
      disabled={disabled}
      focusableWhenDisabled
      onClick={onClick}
      size="lg"
      variant="outline"
    >
      <HelpCircleIcon aria-hidden="true" />
      {label ?? t("I'm not sure")}
    </Button>
  );
}
