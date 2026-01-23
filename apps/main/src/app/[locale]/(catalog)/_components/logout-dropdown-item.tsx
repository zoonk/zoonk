"use client";

import { Link } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { authClient } from "@zoonk/core/auth/client";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { User } from "lucide-react";
import { useExtracted } from "next-intl";

const logoutMenu = getMenu("logout");

export function LogoutDropdownItem() {
  const { data: session } = authClient.useSession();
  const t = useExtracted();

  if (!session) {
    return (
      <DropdownMenuItem render={<Link href="/login" prefetch={false} />}>
        <User aria-hidden="true" />
        {t("Login")}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem render={<Link href="/logout" prefetch={false} />}>
      <logoutMenu.icon aria-hidden="true" />
      {t("Logout")}
    </DropdownMenuItem>
  );
}
