"use client";

import { getPathname } from "@/i18n/navigation";
import { logout } from "@/lib/logout";
import { useAppLocale } from "@zoonk/learn/locale";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { LogInIcon, LogOutIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function AccountDropdownItem({ status }: { status: "account" | "guest" | "visitor" }) {
  const t = useExtracted();
  const locale = useAppLocale();
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
