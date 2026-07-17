import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Link from "next/link";
import { Fragment, Suspense } from "react";
import { AdminPeriodTabs } from "./admin-period-tabs";

type StatsBreadcrumbItem = { href?: string; label: string };

/**
 * The stats pages all share the same dashboard-level navigation, but some
 * sections need extra breadcrumb levels for drill-down pages. This keeps the
 * breadcrumb markup in one place while letting each page opt into deeper
 * navigation when needed.
 */
function StatsBreadcrumb({ items }: { items: StatsBreadcrumbItem[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" prefetch />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/stats" prefetch />}>Stats</BreadcrumbLink>
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

/**
 * Most stats pages share the same container, breadcrumb, and optional header
 * controls. Centralizing that shell keeps section-specific pages focused on
 * their metrics instead of reimplementing layout chrome.
 */
export function StatsPageLayout({
  breadcrumbItems,
  children,
  navigation,
  showPeriodTabs = true,
  title,
}: {
  breadcrumbItems?: StatsBreadcrumbItem[];
  children: React.ReactNode;
  navigation?: React.ReactNode;
  showPeriodTabs?: boolean;
  title: string;
}) {
  const items = breadcrumbItems ?? [{ label: title }];
  const showControls = showPeriodTabs || navigation;

  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup className="flex-1">
          <StatsBreadcrumb items={items} />
          <ContainerTitle>{title}</ContainerTitle>

          {showControls ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              {showPeriodTabs ? (
                <Suspense fallback={<StatsPeriodTabsSkeleton />}>
                  <AdminPeriodTabs />
                </Suspense>
              ) : null}
              {navigation}
            </div>
          ) : null}
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>{children}</ContainerBody>
    </Container>
  );
}

/**
 * Stats routes need a complete prerendered shell while their URL-dependent
 * controls and metrics wait for request data. This keeps that loading shell
 * consistent across every analytics page instead of duplicating it per route.
 */
export function StatsPageSkeleton({
  breadcrumbItems,
  children,
  showPeriodControls = true,
  title,
}: {
  breadcrumbItems?: StatsBreadcrumbItem[];
  children: React.ReactNode;
  showPeriodControls?: boolean;
  title: string;
}) {
  return (
    <StatsPageLayout
      breadcrumbItems={breadcrumbItems}
      navigation={showPeriodControls ? <StatsPeriodNavigationSkeleton /> : undefined}
      showPeriodTabs={showPeriodControls}
      title={title}
    >
      {children}
    </StatsPageLayout>
  );
}

/**
 * Period tabs read the current URL in a client component, so this local
 * fallback keeps that small hook from making the whole analytics shell wait.
 */
function StatsPeriodTabsSkeleton() {
  return (
    <div className="flex gap-1">
      <Skeleton className="h-8 w-16 rounded-4xl" />
      <Skeleton className="h-8 w-20 rounded-4xl" />
      <Skeleton className="h-8 w-14 rounded-4xl" />
      <Skeleton className="h-8 w-12 rounded-4xl" />
    </div>
  );
}

/**
 * The selected date label depends on URL data and a cached clock read. This
 * reserves only that control while runtime prefetching resolves it.
 */
export function StatsPeriodNavigationSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-9 rounded-4xl" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="size-9 rounded-4xl" />
    </div>
  );
}
