"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";

export function BackButton() {
  const { back } = useRouter();
  const t = useExtracted();

  return (
    <Button onClick={() => back()} size="icon" variant="secondary">
      <ChevronLeftIcon />
      <span className="sr-only">{t("Back")}</span>
    </Button>
  );
}
