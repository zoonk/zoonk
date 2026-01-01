import { auth } from "@zoonk/core/auth";
import { getOrganization } from "@zoonk/core/orgs/get";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { getSession } from "@zoonk/core/users/session/get";
import { safeAsync } from "@zoonk/utils/error";
import { headers } from "next/headers";
import { notFound, unauthorized } from "next/navigation";
import { Suspense } from "react";
import { EditorNavbar } from "@/components/navbar";

async function LayoutPermissions({
  children,
  navbarActions,
  params,
}: LayoutProps<"/[orgSlug]">) {
  const { orgSlug } = await params;

  const [sessionData, org, canViewPage] = await Promise.all([
    getSession(),
    getOrganization(orgSlug),
    hasCoursePermission({ orgSlug, permission: "update" }),
  ]);

  if (!org.data) {
    return notFound();
  }

  if (!canViewPage) {
    return unauthorized();
  }

  const activeOrgId = sessionData?.session.activeOrganizationId;
  const orgId = String(org.data.id);

  // We're setting the current org as the active one,
  // so we can automatically redirect users to this org
  // next time they visit the editor
  if (activeOrgId !== orgId) {
    await safeAsync(async () =>
      auth.api.setActiveOrganization({
        body: { organizationId: orgId },
        headers: await headers(),
      }),
    );
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
