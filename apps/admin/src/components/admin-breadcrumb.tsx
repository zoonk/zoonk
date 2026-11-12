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
  current,
  parents,
}: {
  current: React.ReactNode;
  parents: AdminBreadcrumbParent[];
}) {
  return (
    // It sits over a page's title. A list's title is 20 px under the header's top; this line and its gap are 24, so it gives 4 back and every title is at one height.
    <Breadcrumb className="-mt-1">
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
