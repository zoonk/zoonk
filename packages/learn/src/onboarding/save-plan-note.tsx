"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { useExtracted } from "next-intl";
import { useSentenceSpace } from "../_utils/locale";

export function SavePlanNote({
  className,
  signUpHref,
}: {
  className?: string;
  signUpHref: string;
}) {
  const t = useExtracted();
  const space = useSentenceSpace();

  return (
    <p className={cn("text-muted-foreground text-center text-sm", className)}>
      {t("Save your plan so it's here next time.")}
      {space}
      <PendingLink
        className="text-foreground font-medium text-nowrap underline underline-offset-4"
        href={signUpHref}
      >
        {t("Create an account")}
      </PendingLink>
    </p>
  );
}
