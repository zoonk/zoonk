import type { AuthOrganization } from "@zoonk/core/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
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

  if (!organizations || organizations.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>{t("No organizations")}</EmptyTitle>
          <EmptyDescription>
            {t("You're not part of any organization yet")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ItemGroup>
      {organizations.map((org) => (
        <Item asChild key={org.id}>
          <Link href={`/${org.slug}`}>
            <ItemContent>
              <ItemTitle>{org.name}</ItemTitle>
            </ItemContent>

            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          </Link>
        </Item>
      ))}
    </ItemGroup>
  );
}
