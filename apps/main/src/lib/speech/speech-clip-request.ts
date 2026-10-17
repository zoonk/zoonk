"use client";

import { postFromBrowser, readJsonForThisLearner } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { type SpeechClip } from "@zoonk/core/audio/speech-clip-contract";
import { type SpeechClipOutcome } from "@zoonk/learn/speech/provider";
import { toWebOwnFileUrl } from "@zoonk/utils/user-blobs";

const FAILED: SpeechClipOutcome = { limit: null, status: "failed" };

/** What `POST /v1/speech-clips` answered, as a play button shows it. */
async function toSpeechClipOutcome(response: Response): Promise<SpeechClipOutcome> {
  const body = await readJsonForThisLearner(response);

  if (response.ok) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The API validates successful responses with speechClipResponseSchema.
    const clip = body as SpeechClip | null;
    return clip ? { status: "ready", url: toWebOwnFileUrl(clip.url) } : FAILED;
  }

  return { limit: readRefusedLimit({ body, status: response.status }), status: "failed" };
}

/**
 * Text read aloud for the web's learn screens and lesson player: the shared clip from the API, or
 * a new one voiced the first time anyone asks; the learner's own words (`personal`) play from
 * their private file through the web's file route (`toWebOwnFileUrl`). It goes from the browser on
 * the learner's tap, so a clip that takes seconds never holds up the page's Server Actions.
 */
export async function requestSpeechClip({
  language,
  personal = false,
  text,
}: {
  language: string;
  personal?: boolean;
  text: string;
}): Promise<SpeechClipOutcome> {
  const response = await postFromBrowser({
    body: { language, personal, text },
    path: "/v1/speech-clips",
  });

  return response ? toSpeechClipOutcome(response) : FAILED;
}
