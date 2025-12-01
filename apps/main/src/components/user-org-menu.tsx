"use client";

import { authClient } from "@zoonk/auth/client";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@zoonk/ui/components/dropdown-menu";
import { useExtracted } from "next-intl";
import { ClientLink } from "@/i18n/client-link";
import { getMenu } from "@/lib/menu";

export function UserOrgMenu() {
  const t = useExtracted();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";

  if (!isAdmin) {
    return null;
  }

  const orgMenu = [{ key: t("Editor"), ...getMenu("editor") }];

  return (
    <>
      {orgMenu.map((menu) => (
        <DropdownMenuItem asChild key={menu.key}>
          <ClientLink href={menu.url}>
            <menu.icon aria-hidden="true" />
            {menu.key}
          </ClientLink>
        </DropdownMenuItem>
      ))}

      <DropdownMenuSeparator />
    </>
  );
}
