"use client";

import { getPathname } from "@/i18n/navigation";
import { logout } from "@/lib/logout";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { LogInIcon, LogOutIcon, UserPlusIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";

/**
 * The menu's way in or out: visitors log in, guests create the account that keeps their plan (or
 * log in to the one they already have), and accounts log out.
 */
export function AccountDropdownItem({ status }: { status: "account" | "guest" | "visitor" }) {
  const t = useExtracted();
  const locale = useLocale();
  const loginHref = getPathname({ href: "/login", locale });

  if (status === "visitor") {
    return (
      <DropdownMenuItem render={<a href={loginHref} />}>
        <LogInIcon aria-hidden="true" />
        {t("Log in")}
      </DropdownMenuItem>
    );
  }

  if (status === "guest") {
    return (
      <>
        <DropdownMenuItem render={<a href={loginHref} />}>
          <UserPlusIcon aria-hidden="true" />
          {t("Create an account")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={loginHref} />}>
          <LogInIcon aria-hidden="true" />
          {t("Log in")}
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <DropdownMenuItem onClick={() => void logout()}>
      <LogOutIcon aria-hidden="true" />
      {t("Log out")}
    </DropdownMenuItem>
  );
}
