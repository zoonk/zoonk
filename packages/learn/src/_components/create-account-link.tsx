"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";

/**
 * A guest's way on when their own cap or the day's AI budget all guests share stops them: a free
 * account, where their work moves.
 */
export function CreateAccountLink() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <a className={buttonVariants({ size: "sm", variant: "outline" })} href={routes.signUp}>
      {t("Create a free account")}
    </a>
  );
}
