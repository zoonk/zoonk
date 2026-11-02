"use client";

import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";

export const STATUS_LINK_CLASS =
  "text-muted-foreground hover:text-foreground font-medium underline underline-offset-2";

export function ChangeLimitLink({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <LearnLink className={STATUS_LINK_CLASS} href={href} prefetch={false}>
      {t("Change limit")}
    </LearnLink>
  );
}
