import { type AuthOrganization, type Organization } from "./org";

export function findOrganizationById(
  orgs: Organization[] | AuthOrganization[],
  orgId?: string | null,
) {
  return orgs.find((org) => org.id === orgId) ?? null;
}
