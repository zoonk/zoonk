import { EditorNavbar } from "@/components/navbar";
import { getOrganization } from "@zoonk/core/orgs/get";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { FullPageLoading } from "@zoonk/ui/components/loading";
import { notFound, unauthorized } from "next/navigation";
import { Suspense } from "react";

async function LayoutPermissions({ children, navbarActions, params }: LayoutProps<"/[orgSlug]">) {
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

export default async function OrgHomeLayout({ children, ...props }: LayoutProps<"/[orgSlug]">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LayoutPermissions {...props}>{children}</LayoutPermissions>
    </Suspense>
  );
}
