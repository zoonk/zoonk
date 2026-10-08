"use client";

import { Link } from "@/i18n/navigation";
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
      <Link
        className={buttonVariants({ size: "bar", variant: "outline" })}
        href="/login"
        prefetch={false}
      >
        {t("Log in")}
      </Link>
    );
  }

  return (
    <Link
      className={buttonVariants({ size: "bar", variant: "outline" })}
      href="/login"
      prefetch={false}
    >
      {t("Create an account")}
    </Link>
  );
}
