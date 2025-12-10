import {
  getOrganizationId,
  hasCoursePermission,
} from "@zoonk/core/organizations";
import { notFound, unauthorized } from "next/navigation";

export default async function OrgHomeLayout({
  children,
  params,
}: LayoutProps<"/[orgSlug]">) {
  const { orgSlug } = await params;
  const { data: organizationId } = await getOrganizationId(orgSlug);

  if (!organizationId) {
    return notFound();
  }

  const canViewPage = await hasCoursePermission(organizationId, "update");

  if (!canViewPage) {
    return unauthorized();
  }

  return <>{children}</>;
}
