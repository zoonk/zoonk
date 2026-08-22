export const GENERATION_VISITOR_ID_HEADER = "X-Generation-Visitor-Id";

export type GenerationQuotaPeriod = "day" | "month";
export type GenerationQuotaResource = "chapter" | "course" | "lesson" | "lessonQuestion";
export type GenerationQuotaViewer = "authenticated" | "guest" | "subscriber";

export type GenerationQuotaActor = { distinctId: string; username: string | null };

export type GenerationQuotaLimit = {
  period: GenerationQuotaPeriod;
  resource: GenerationQuotaResource;
  viewer: GenerationQuotaViewer;
};

export type GenerationQuotaResult =
  | { status: "ready" }
  | { actor: GenerationQuotaActor; limit: GenerationQuotaLimit; status: "limitReached" };
