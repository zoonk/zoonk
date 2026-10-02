"use client";

import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";

/**
 * A guest's soft prompt to keep their plan: under the plan reveal and again when their first
 * session ends. Signing up moves the guest's progress to the new account.
 */
export function SavePlanNote({ signUpHref }: { signUpHref: string }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-center text-sm">
      {t("Save your plan so it's here next time.")}{" "}
      <LearnLink
        className="text-foreground font-medium underline underline-offset-4"
        href={signUpHref}
      >
        {t("Create an account")}
      </LearnLink>
    </p>
  );
}
