import { type auth } from "@zoonk/auth";

export type AuthOrganization = typeof auth.$Infer.Organization;

export type { UserWithRole } from "better-auth/plugins";

export type { Organization } from "@zoonk/db";
