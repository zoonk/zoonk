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
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {parents.map((parent) => (
          <Fragment key={parent.href}>
            <BreadcrumbItem>
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
          <BreadcrumbPage className="max-w-sm truncate">{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
