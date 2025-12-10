import type { auth } from "@zoonk/auth";

export type AuthOrganization = typeof auth.$Infer.Organization;

export type {
  Account,
  Course,
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
