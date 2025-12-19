import type { AuthOrganization } from "@zoonk/core/types";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { EmptyView } from "@zoonk/ui/patterns/empty";
import { Building2Icon, ChevronRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export function OrganizationListSkeleton() {
  return (
    <ItemGroup>
      {Array.from({ length: 3 }).map((_, index) => (
        <Item key={index}>
          <ItemContent>
            <Skeleton className="h-4 w-48" />
          </ItemContent>

          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </Item>
      ))}
    </ItemGroup>
  );
}

export async function OrganizationList({
  organizations,
}: {
  organizations: AuthOrganization[];
}) {
  const t = await getExtracted();

  if (organizations.length === 0) {
    return (
      <EmptyView
        description={t("You're not part of any organization yet")}
        icon={Building2Icon}
        title={t("No organizations")}
      />
    );
  }

  return (
    <ItemGroup>
      {organizations.map((org) => (
        <Item
          key={org.id}
          render={<Link href={`/${org.slug}`} prefetch={true} />}
        >
          <ItemContent>
            <ItemTitle>{org.name}</ItemTitle>
          </ItemContent>

          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </Item>
      ))}
    </ItemGroup>
  );
}
