"use client";

import { getFromBrowser } from "@/lib/api/browser-api";
import { type WarmUpDeck, warmUpDeckSchema } from "@zoonk/core/library/warm-ups/contract";

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

export async function readWarmUp(warmUpId: string): Promise<WarmUpDeck | null> {
  const response = await getFromBrowser(`/v1/warm-ups/${encodeURIComponent(warmUpId)}`);

  if (response?.status === HTTP_UNAUTHORIZED || response?.status === HTTP_NOT_FOUND) {
    return null;
  }

  if (!response?.ok) {
    throw new Error(`Couldn't read warm-up ${warmUpId}: ${response?.status ?? "no response"}`);
  }

  const body: unknown = await response.json();
  return warmUpDeckSchema.parse(body);
}
