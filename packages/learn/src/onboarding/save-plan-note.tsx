"use client";

import { useExtracted } from "next-intl";

export function SavePlanNote({ signUpHref }: { signUpHref: string }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground text-center text-sm">
      {t("Save your plan so it's here next time.")}{" "}
      <a className="text-foreground font-medium underline underline-offset-4" href={signUpHref}>
        {t("Create an account")}
      </a>
    </p>
  );
}
