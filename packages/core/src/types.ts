import type { auth } from "@zoonk/auth";

export type AuthOrganization = typeof auth.$Infer.Organization;

/**
 * Represents a diff for content changes.
 * Each field contains before/after values for changed fields only.
 */
export type ContentDiff = {
  [field: string]: {
    after: unknown;
    before: unknown;
  };
};

export type {
  Account,
  ChangeComment,
  ChangeStatus,
  ContentChange,
  ContentType,
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
