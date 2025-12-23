"use client";

import { authClient } from "@zoonk/auth/client";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BuildingIcon, ChevronsUpDownIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";

export function OrgSwitcherSkeleton() {
  return <Skeleton className="h-8 w-36 rounded-full" />;
}

export function OrgSwitcher({ children }: React.PropsWithChildren) {
  const t = useExtracted();
  const params = useParams<{ orgSlug: string }>();
  const { data: organizations, isPending } = authClient.useListOrganizations();

  if (isPending) {
    return <OrgSwitcherSkeleton />;
  }

  const currentOrg = organizations?.find((org) => org.slug === params.orgSlug);

  const otherOrgs =
    organizations?.filter((org) => org.id !== currentOrg?.id) ?? [];

  return (
    // Key forces remount when org changes, fixing Base UI Menu context disconnection
    <DropdownMenu key={params.orgSlug}>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ size: "sm", variant: "outline" }),
          "gap-2",
        )}
      >
        <BuildingIcon aria-hidden="true" />
        <span className="max-w-32 truncate">
          {currentOrg?.name ?? t("Organizations")}
        </span>

        <ChevronsUpDownIcon
          aria-hidden="true"
          className="text-muted-foreground/50 contrast-more:text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {otherOrgs.length === 0 ? (
          <DropdownMenuItem disabled>
            {t("No other organizations")}
          </DropdownMenuItem>
        ) : (
          otherOrgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              render={<Link href={`/${org.slug}`} />}
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
