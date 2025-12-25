import { findOrganizationById } from "@zoonk/core/orgs/find";
import { listUserOrgs } from "@zoonk/core/users/orgs/list";
import { getSession } from "@zoonk/core/users/session/get";
import { redirect, unauthorized } from "next/navigation";

export default async function HomePage() {
  const [userSession, orgs] = await Promise.all([getSession(), listUserOrgs()]);

  const firstOrg = orgs.data[0];

  const activeOrganizationId =
    userSession?.session.activeOrganizationId ?? firstOrg?.id;

  const activeOrganization = findOrganizationById(
    orgs.data,
    activeOrganizationId,
  );

  if (activeOrganization) {
    redirect(`/${activeOrganization.slug}`);
  }

  // restrict access when they don't belong to any organization
  return unauthorized();
}
