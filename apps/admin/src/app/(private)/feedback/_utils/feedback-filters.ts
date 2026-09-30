import { type ContentFeedbackFilters } from "@/data/feedback/_utils/content-feedback-where";
import { type AdminQueryParams } from "@/lib/admin-href";
import { readEnumQueryParam, readQueryParam } from "@/lib/query-param";
import { ContentFeedbackReason, FeedbackContentKind, FeedbackStatus, VoteValue } from "@zoonk/db";

type SearchParams = Partial<Record<string, string | string[]>>;

export function parseContentFeedbackFilters(params: SearchParams): ContentFeedbackFilters {
  return {
    contentKind: readEnumQueryParam({
      allowed: Object.values(FeedbackContentKind),
      value: params.kind,
    }),
    model: readQueryParam(params.model) || undefined,
    promptVersion: readQueryParam(params.promptVersion) || undefined,
    reason: readEnumQueryParam({
      allowed: Object.values(ContentFeedbackReason),
      value: params.reason,
    }),
    vote: readEnumQueryParam({ allowed: Object.values(VoteValue), value: params.vote }),
  };
}

/** The same filters as URL params, for pagination and the vote filter links. */
export function toContentFeedbackQueryParams(filters: ContentFeedbackFilters): AdminQueryParams {
  return {
    kind: filters.contentKind,
    model: filters.model,
    promptVersion: filters.promptVersion,
    reason: filters.reason,
    vote: filters.vote,
  };
}

export function parseFeedbackStatus(params: SearchParams): FeedbackStatus | undefined {
  return readEnumQueryParam({ allowed: Object.values(FeedbackStatus), value: params.status });
}
