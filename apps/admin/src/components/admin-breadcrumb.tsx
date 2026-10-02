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

/**
 * Detail pages link back to their list (and any parent record) with the same
 * compact trail. The last entry is the current page and has no link.
 */
export function AdminBreadcrumb({
  current,
  parents,
}: {
  current: string;
  parents: { href: string; label: string }[];
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {parents.map((parent) => (
          <Fragment key={parent.href}>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={parent.href} prefetch />}>
                {parent.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
