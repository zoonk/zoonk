"use client";

import { Button } from "@zoonk/ui/components/button";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function BackButton() {
  const { back } = useRouter();
  const t = useExtracted();

  return (
    <Button
      className="cursor-pointer"
      onClick={() => back()}
      size="icon"
      variant="secondary"
    >
      <ChevronLeftIcon />
      <span className="sr-only">{t("Back")}</span>
    </Button>
  );
}
