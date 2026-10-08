"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { speechClipSchema } from "@zoonk/core/audio/speech-clip-contract";
import { type SpeechClipOutcome } from "@zoonk/learn/speech/provider";
import { getUsageRefusal } from "@zoonk/player/usage-refusal";

const FAILED: SpeechClipOutcome = { limit: null, status: "failed" };

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/** What `POST /v1/speech-clips` answered, as a play button shows it. */
async function toSpeechClipOutcome(response: Response): Promise<SpeechClipOutcome> {
  const body = await readBody(response);

  if (response.ok) {
    const clip = speechClipSchema.safeParse(body);
    return clip.success ? { status: "ready", url: clip.data.url } : FAILED;
  }

  const refusal = getUsageRefusal(body);

  if (refusal?.kind === "slowDown") {
    return {
      limit: { retryAfterSeconds: refusal.retryAfterSeconds, status: "slowDown" },
      status: "failed",
    };
  }

  return refusal
    ? {
        limit: { period: refusal.period, status: "limitReached", tier: refusal.tier },
        status: "failed",
      }
    : FAILED;
}

/**
 * Text read aloud for the web's learn screens and lesson player: the shared clip from the API, or
 * a new one voiced the first time anyone asks. It goes from the browser on the learner's tap, so a
 * clip that takes seconds never holds up the page's Server Actions.
 */
export async function requestSpeechClip({
  language,
  text,
}: {
  language: string;
  text: string;
}): Promise<SpeechClipOutcome> {
  const response = await postFromBrowser({ body: { language, text }, path: "/v1/speech-clips" });
  return response ? toSpeechClipOutcome(response) : FAILED;
}
