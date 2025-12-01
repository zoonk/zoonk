import {
  getOrganizationId,
  hasCoursePermission,
} from "@zoonk/api/organizations";
import { notFound, unauthorized } from "next/navigation";

export async function EditorPermissions({
  children,
  params,
}: LayoutProps<"/[locale]/editor/[orgSlug]">) {
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
