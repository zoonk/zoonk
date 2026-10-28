export const START_AGAIN_PARAM = "again";

export const DRAFT_PARAM = "draft";

export function getDraftHref(draftId: string) {
  return `/start?${DRAFT_PARAM}=${encodeURIComponent(draftId)}` as const;
}
