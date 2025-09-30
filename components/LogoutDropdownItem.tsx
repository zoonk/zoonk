"use client";

import { useTranslations } from "next-intl";
import { useLogout } from "@/hooks/useLogout";
import { getMenu } from "./menu";
import { DropdownMenuItem } from "./ui/dropdown-menu";

const logoutMenu = getMenu("logout");

export function LogoutDropdownItem() {
  const t = useTranslations("Menu");
  const { logout } = useLogout();

  return (
    <DropdownMenuItem onSelect={logout}>
      <logoutMenu.icon aria-hidden="true" />
      {t(logoutMenu.i18nKey)}
    </DropdownMenuItem>
  );
}
