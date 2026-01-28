import { type auth } from "@zoonk/auth";

export type AuthOrganization = typeof auth.$Infer.Organization;

export type { CoursePermission } from "@zoonk/auth/permissions";
export type { UserWithRole } from "better-auth/plugins";

export type {
  Account,
  Course,
  CourseAlternativeTitle,
  CourseSuggestion,
  Invitation,
  Member,
  Organization,
  RateLimit,
  Session,
  Subscription,
  User,
  Verification,
} from "@zoonk/db";
