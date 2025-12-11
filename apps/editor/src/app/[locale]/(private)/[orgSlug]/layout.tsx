import {
  getOrganizationId,
  hasCoursePermission,
} from "@zoonk/core/organizations";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { notFound, unauthorized } from "next/navigation";
import { Suspense } from "react";

async function LayoutPermissions({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutProps<"/[locale]/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;
  const { data: organizationId } = await getOrganizationId(orgSlug);

  if (!organizationId) {
    return notFound();
  }

  const canViewPage = await hasCoursePermission(organizationId, "update");

  if (!canViewPage) {
    return unauthorized();
  }

  return <div>{children}</div>;
}

export default async function OrgHomeLayout({
  children,
  params,
}: LayoutProps<"/[locale]/[orgSlug]">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LayoutPermissions params={params}>{children}</LayoutPermissions>
    </Suspense>
  );
}
