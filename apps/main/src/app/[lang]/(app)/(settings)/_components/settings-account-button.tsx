"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LogInIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/** A gated page already ends in this same button, so the bar leaves it out there. */
const GATED_PAGE_CLASS = "in-[body:has([data-auth-gate])]:hidden";

export function SettingsAccountButton({ status }: { status: "guest" | "visitor" }) {
  const t = useExtracted();

  if (status === "visitor") {
    return (
      <CurrentPageLoginLink
        className={buttonVariants({ className: GATED_PAGE_CLASS, size: "bar", variant: "outline" })}
        icon={<LogInIcon aria-hidden="true" />}
      >
        {t("Log in")}
      </CurrentPageLoginLink>
    );
  }

  return (
    <CurrentPageLoginLink
      className={buttonVariants({ className: GATED_PAGE_CLASS, size: "bar", variant: "outline" })}
      icon={<UserPlusIcon aria-hidden="true" />}
    >
      {t("Create an account")}
    </CurrentPageLoginLink>
  );
}
