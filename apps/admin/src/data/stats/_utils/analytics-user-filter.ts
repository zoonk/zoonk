import { sql } from "@zoonk/db";

export const trackedAnalyticsUserWhere = { analyticsDisabled: false } as const;
export const trackedAnalyticsUserRelationWhere = { user: trackedAnalyticsUserWhere } as const;
export const trackedAnalyticsUserSql = sql`users.analytics_disabled = FALSE`;
