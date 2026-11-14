"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LogInIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/** A page that already asks for an account in its own words (a gate, Reminders' email row) doesn't repeat the button in the bar. */
const GATED_PAGE_CLASS = "in-[body:has([data-account-ask])]:hidden";

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
