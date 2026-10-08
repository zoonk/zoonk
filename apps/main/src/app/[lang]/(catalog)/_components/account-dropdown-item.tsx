"use client";

import { Link } from "@/i18n/navigation";
import { logout } from "@/lib/logout";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { LogInIcon, LogOutIcon, UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * The menu's way in or out: visitors log in, guests create the account that keeps their plan, and
 * accounts log out.
 */
export function AccountDropdownItem({ status }: { status: "account" | "guest" | "visitor" }) {
  const t = useExtracted();

  if (status === "visitor") {
    return (
      <DropdownMenuItem render={<Link href="/login" prefetch={false} />}>
        <LogInIcon aria-hidden="true" />
        {t("Login")}
      </DropdownMenuItem>
    );
  }

  if (status === "guest") {
    return (
      <DropdownMenuItem render={<Link href="/login" prefetch={false} />}>
        <UserPlusIcon aria-hidden="true" />
        {t("Create an account")}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem onClick={() => void logout()}>
      <LogOutIcon aria-hidden="true" />
      {t("Logout")}
    </DropdownMenuItem>
  );
}
