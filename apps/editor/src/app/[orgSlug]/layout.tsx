import { getOrganization } from "@zoonk/core/orgs/get";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { notFound, unauthorized } from "next/navigation";
import { Suspense } from "react";
import { EditorNavbar } from "@/components/navbar";

async function LayoutPermissions({
  children,
  navbarActions,
  params,
}: LayoutProps<"/[orgSlug]">) {
  const { orgSlug } = await params;

  const [org, canViewPage] = await Promise.all([
    getOrganization(orgSlug),
    hasCoursePermission({ orgSlug, permission: "update" }),
  ]);

  if (!org.data) {
    return notFound();
  }

  if (!canViewPage) {
    return unauthorized();
  }

  return (
    <div>
      <EditorNavbar>{navbarActions}</EditorNavbar>

      {children}
    </div>
  );
}

export default async function OrgHomeLayout({
  children,
  ...props
}: LayoutProps<"/[orgSlug]">) {
  return (
    <Suspense>
      <LayoutPermissions {...props}>{children}</LayoutPermissions>
    </Suspense>
  );
}
