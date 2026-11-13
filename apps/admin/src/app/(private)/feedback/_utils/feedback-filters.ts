import { readEnumQueryParam } from "@/lib/query-param";
import { type FeedbackStatus } from "@zoonk/db";

/** The inbox opens on what's waiting, so "new" is the filter with no query. */
export const FEEDBACK_FILTERS = ["new", "read", "replied", "all"] as const;

export type FeedbackFilter = (typeof FEEDBACK_FILTERS)[number];

type SearchParams = Partial<Record<string, string | string[]>>;

export function parseFeedbackFilter(params: SearchParams): FeedbackFilter {
  return readEnumQueryParam({ allowed: FEEDBACK_FILTERS, value: params.status }) ?? "new";
}

export function toFeedbackStatus(filter: FeedbackFilter): FeedbackStatus | undefined {
  return filter === "all" ? undefined : filter;
}
