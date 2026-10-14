"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";

/**
 * The bar's way in: a guest's "Create an account" keeps their plan, and a visitor's "Log in" is the
 * way in, so both read as buttons. An account's way out is rare, so it waits at the end of the
 * settings list instead (`SettingsHubLists`).
 */
export function SettingsAccountButton({ status }: { status: "guest" | "visitor" }) {
  const t = useExtracted();

  if (status === "visitor") {
    return (
      <CurrentPageLoginLink className={buttonVariants({ size: "bar", variant: "outline" })}>
        {t("Log in")}
      </CurrentPageLoginLink>
    );
  }

  return (
    <CurrentPageLoginLink className={buttonVariants({ size: "bar", variant: "outline" })}>
      {t("Create an account")}
    </CurrentPageLoginLink>
  );
}
