"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { useExtracted } from "next-intl";
import { useLearnRoutes } from "../learn-context";

export function CreateAccountLink() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <PendingLink
      className={buttonVariants({ size: "sm", variant: "outline" })}
      href={routes.signUp}
    >
      {t("Create a free account")}
    </PendingLink>
  );
}
