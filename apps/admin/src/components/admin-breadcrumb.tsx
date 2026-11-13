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

export type AdminBreadcrumbParent = { href: string; label: string };

export function AdminBreadcrumb({
  className,
  current,
  parents,
}: {
  className?: string;
  current: React.ReactNode;
  parents: AdminBreadcrumbParent[];
}) {
  return (
    // The line over a page's title: 16 px and the header's 4 px gap, so every title starts 20 px down.
    <Breadcrumb className={className} data-slot="page-eyebrow">
      <BreadcrumbList className="text-compact flex-nowrap gap-1.5 leading-4 sm:gap-1.5">
        {parents.map((parent) => (
          <Fragment key={parent.href}>
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink
                className="hit-area relative"
                render={<Link href={parent.href} prefetch />}
              >
                {parent.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem className="min-w-0 flex-1">
          <BreadcrumbPage className="max-w-sm truncate font-medium">{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
