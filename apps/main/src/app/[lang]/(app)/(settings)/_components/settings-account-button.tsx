"use client";

import { CurrentPageLoginLink } from "@/components/current-page-login-link";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LogInIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function SettingsAccountButton({ status }: { status: "guest" | "visitor" }) {
  const t = useExtracted();

  if (status === "visitor") {
    return (
      <CurrentPageLoginLink
        className={buttonVariants({ size: "bar", variant: "outline" })}
        icon={<LogInIcon aria-hidden="true" />}
      >
        {t("Log in")}
      </CurrentPageLoginLink>
    );
  }

  return (
    <CurrentPageLoginLink
      className={buttonVariants({ size: "bar", variant: "outline" })}
      icon={<UserPlusIcon aria-hidden="true" />}
    >
      {t("Create an account")}
    </CurrentPageLoginLink>
  );
}
