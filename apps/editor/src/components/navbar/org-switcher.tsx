"use client";

import { authClient } from "@zoonk/core/auth/client";
import { type AuthOrganization } from "@zoonk/core/types";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { BuildingIcon, ChevronsUpDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";

export function OrgSwitcher({
  children,
  organizations,
}: {
  organizations: AuthOrganization[];
} & React.PropsWithChildren) {
  const t = useExtracted();
  const params = useParams<{ orgSlug: string }>();

  const currentOrg = organizations.find((org) => org.slug === params.orgSlug);

  const otherOrgs = organizations.filter((org) => org.id !== currentOrg?.id);

  function handleOrgClick(orgSlug: string) {
    // Set active org fire-and-forget (don't block navigation)
    void authClient.organization.setActive({ organizationSlug: orgSlug });
  }

  return (
    // Key forces remount when org changes, fixing Base UI Menu context disconnection
    <DropdownMenu key={params.orgSlug}>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-2")}
      >
        <BuildingIcon aria-hidden="true" />
        <span className="max-w-32 truncate">{currentOrg?.name ?? t("Organizations")}</span>

        <ChevronsUpDownIcon
          aria-hidden="true"
          className="text-muted-foreground/50 contrast-more:text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {otherOrgs.length === 0 ? (
          <DropdownMenuItem disabled>{t("No other organizations")}</DropdownMenuItem>
        ) : (
          otherOrgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              render={<Link href={`/${org.slug}`} onClick={() => handleOrgClick(org.slug)} />}
            >
              <BuildingIcon aria-hidden="true" />
              <span className="truncate">{org.name}</span>
            </DropdownMenuItem>
          ))
        )}

        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
