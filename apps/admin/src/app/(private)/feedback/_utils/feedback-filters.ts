import { readEnumQueryParam } from "@/lib/query-param";
import { FeedbackStatus } from "@zoonk/db";

type SearchParams = Partial<Record<string, string | string[]>>;

export function parseFeedbackStatus(params: SearchParams): FeedbackStatus | undefined {
  return readEnumQueryParam({ allowed: Object.values(FeedbackStatus), value: params.status });
}
