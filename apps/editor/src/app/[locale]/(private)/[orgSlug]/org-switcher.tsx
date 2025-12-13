"use client";

import { authClient } from "@zoonk/auth/client";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BuildingIcon, ChevronsUpDownIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { Link } from "@/i18n/navigation";

export function OrgSwitcherSkeleton() {
  return <Skeleton className="size-9 rounded-md" />;
}

export function OrgSwitcher() {
  const t = useExtracted();
  const params = useParams<{ orgSlug: string }>();
  const { data: organizations, isPending } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();

  if (isPending) {
    return <OrgSwitcherSkeleton />;
  }

  const currentOrg =
    activeOrg ?? organizations?.find((org) => org.slug === params.orgSlug);

  const otherOrgs =
    organizations?.filter((org) => org.id !== currentOrg?.id) ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ size: "sm", variant: "outline" }),
          "gap-2",
        )}
      >
        <BuildingIcon aria-hidden="true" className="size-4" />
        <span className="max-w-32 truncate">
          {currentOrg?.name ?? t("Organizations")}
        </span>

        <ChevronsUpDownIcon
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("Switch organization")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {otherOrgs.length === 0 ? (
          <DropdownMenuItem disabled>
            {t("No other organizations")}
          </DropdownMenuItem>
        ) : (
          otherOrgs.map((org) => (
            <DropdownMenuItem asChild key={org.id}>
              <Link href={`/${org.slug}`}>
                <BuildingIcon aria-hidden="true" className="size-4" />
                <span className="truncate">{org.name}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
