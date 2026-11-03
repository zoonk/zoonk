"use client";

import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { useExtracted } from "next-intl";
import { useSentenceSpace } from "../_utils/locale";

export function SavePlanNote({ signUpHref }: { signUpHref: string }) {
  const t = useExtracted();
  const space = useSentenceSpace();

  return (
    <p className="text-muted-foreground text-center text-sm">
      {t("Save your plan so it's here next time.")}
      {space}
      <PendingLink
        className="text-foreground font-medium underline underline-offset-4"
        href={signUpHref}
      >
        {t("Create an account")}
      </PendingLink>
    </p>
  );
}
