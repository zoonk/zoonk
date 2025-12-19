import { findOrganizationById } from "@zoonk/core/organizations";
import { getSession, listUserOrgs } from "@zoonk/core/users";
import { unauthorized } from "next/navigation";
import { redirect } from "@/i18n/navigation";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const [userSession, orgs] = await Promise.all([getSession(), listUserOrgs()]);
  const { locale } = await params;

  const firstOrg = orgs.data[0];

  const activeOrganizationId =
    userSession?.session.activeOrganizationId ?? firstOrg?.id;

  const activeOrganization = findOrganizationById(
    orgs.data,
    activeOrganizationId,
  );

  if (activeOrganization) {
    redirect({ href: `/${activeOrganization.slug}`, locale });
  }

  // restrict access when they don't belong to any organization
  return unauthorized();
}
