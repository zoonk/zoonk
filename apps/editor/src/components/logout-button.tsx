"use client";

import { logout } from "@zoonk/core/auth/client";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";

export function LogoutButton() {
  const t = useExtracted();

  return <Button onClick={() => logout()}>{t("Logout")}</Button>;
}
