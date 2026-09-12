import "server-only";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

/** Trusted persisted workflow reads only. HTTP and UI entry points must authorize the acting learner first. */
export function getGeneratedCourseWhere() {
  return {
    OR: [
      { organization: { slug: AI_ORG_SLUG }, userId: null },
      { organizationId: null, userId: { not: null } },
    ],
  };
}
