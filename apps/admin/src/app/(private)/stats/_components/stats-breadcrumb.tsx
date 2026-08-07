import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import Link from "next/link";
import { Fragment } from "react";

export type StatsBreadcrumbItem = { href?: string; label: string };
const EMPTY_STATS_BREADCRUMB_ITEMS: StatsBreadcrumbItem[] = [];

/**
 * Every stats surface begins at Dashboard and Stats. Explorer pages stop there,
 * while drill-down pages append their own hierarchy without duplicating the
 * shared breadcrumb markup.
 */
export function StatsBreadcrumb({
  items = EMPTY_STATS_BREADCRUMB_ITEMS,
}: {
  items?: StatsBreadcrumbItem[];
}) {
  const isStatsPage = items.length === 0;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" prefetch />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {isStatsPage ? (
            <BreadcrumbPage>Stats</BreadcrumbPage>
          ) : (
            <BreadcrumbLink render={<Link href="/stats" prefetch />}>Stats</BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {items.map((item, index) => {
          const isLastItem = index === items.length - 1;
          const itemKey = item.href ?? item.label;

          return (
            <Fragment key={itemKey}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLastItem || !item.href ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href} prefetch />}>
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
