import type { AuthOrganization, Organization } from "../types";

export function findOrganizationById(
  orgs: Organization[] | AuthOrganization[],
  orgId?: string | null,
) {
  return orgs.find((org) => Number(org.id) === Number(orgId)) ?? null;
}
