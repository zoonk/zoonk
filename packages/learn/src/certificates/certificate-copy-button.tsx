"use client";

import { Button } from "@zoonk/ui/components/button";
import { useClipboard } from "@zoonk/ui/hooks/clipboard";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function CopyButton({ label, text }: { label: string; text: string }) {
  const t = useExtracted();
  const { copy, isCopied } = useClipboard();

  return (
    <Button
      aria-label={isCopied ? undefined : label}
      className="shrink-0"
      onClick={() => void copy(text)}
      size="sm"
      type="button"
      variant="outline"
    >
      {isCopied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      <span aria-live="polite">{isCopied ? t("Copied") : t("Copy")}</span>
    </Button>
  );
}
