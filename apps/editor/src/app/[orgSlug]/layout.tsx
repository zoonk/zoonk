import { auth } from "@zoonk/auth";
import { getOrganization } from "@zoonk/core/orgs/get";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
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
  const [org, canViewPage] = await Promise.all([
    getOrganization(orgSlug),
    hasCoursePermission({
      orgSlug,
      permission: "update",
    }),
    // We're setting the current org as the active one,
    // so we can automatically redirect users to this org
    // next time they visit the editor
    auth.api.setActiveOrganization({
      body: { organizationSlug: orgSlug },
      headers: await headers(),
    }),
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
