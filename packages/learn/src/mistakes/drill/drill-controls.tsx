"use client";

import { Button } from "@zoonk/ui/components/button";
import { HelpCircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";

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
      icon={<HelpCircleIcon aria-hidden="true" />}
      onClick={onClick}
      size="lg"
      variant="outline"
    >
      {label ?? t("I'm not sure")}
    </Button>
  );
}
