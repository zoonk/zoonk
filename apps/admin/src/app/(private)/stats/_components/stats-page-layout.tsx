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
import Link from "next/link";
import { Fragment } from "react";
import { AdminPeriodTabs } from "./admin-period-tabs";

type StatsBreadcrumbItem = {
  href?: string;
  label: string;
};

/**
 * The stats pages all share the same dashboard-level navigation, but some
 * sections need an extra breadcrumb level such as `AI Tasks > Course Suggestions`.
 * This keeps the breadcrumb markup in one place while letting each page opt into
 * deeper navigation when needed.
 */
function StatsBreadcrumb({ items }: { items: StatsBreadcrumbItem[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/stats" />}>Stats</BreadcrumbLink>
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
                  <BreadcrumbLink render={<Link href={item.href} />}>{item.label}</BreadcrumbLink>
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
              {showPeriodTabs ? <AdminPeriodTabs /> : null}
              {navigation}
            </div>
          ) : null}
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>{children}</ContainerBody>
    </Container>
  );
}
