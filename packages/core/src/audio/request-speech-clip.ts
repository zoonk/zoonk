import "server-only";
import { type MediaAsset } from "@zoonk/db";
import { claimAssist } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { getSession } from "../users/get-session";
import { findSpeechClip, getPendingSpeechClip, voiceSpeechClip } from "./_utils/speech-clips";
import {
  NEW_SPEECH_CLIP_MAX_CHARACTERS,
  type SpeechClip,
  type SpeechClipInput,
  normalizeSpeechText,
  speechClipInputSchema,
} from "./speech-clip-contract";
import { getSpeechClipKey } from "./speech-clip-key";

type RequestSpeechClipResult =
  | { status: "unauthorized" }
  | { status: "invalid" }
  | { status: "failed" }
  | RefusedUsage
  | { clip: SpeechClip; status: "ready" };

function toSpeechClip(asset: MediaAsset): SpeechClip {
  return {
    durationMs: asset.durationMs,
    id: asset.id,
    language: asset.language ?? "",
    url: asset.url,
  };
}

/** Requires a signed-in learner or guest. Call only after a learner action: a new clip spends AI help. */
export async function requestSpeechClip(input: SpeechClipInput): Promise<RequestSpeechClipResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const parsed = speechClipInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "invalid" };
  }

  const language = parsed.data.language;
  const text = normalizeSpeechText(parsed.data.text);
  const ownerId = parsed.data.personal ? session.user.id : null;
  const reuseKey = getSpeechClipKey({ language, ownerId, text });
  const stored = await findSpeechClip(reuseKey);

  if (stored) {
    return { clip: toSpeechClip(stored), status: "ready" };
  }

  const pending = getPendingSpeechClip(reuseKey);

  if (pending) {
    const prepared = await pending;
    return prepared ? { clip: toSpeechClip(prepared), status: "ready" } : { status: "failed" };
  }

  if (parsed.data.text.length > NEW_SPEECH_CLIP_MAX_CHARACTERS) {
    return { status: "invalid" };
  }

  const usage = await claimAssist();

  if (usage.status !== "allowed") {
    return usage;
  }

  const created = await voiceSpeechClip({
    analytics: { distinctId: session.user.id },
    language,
    ownerId,
    reuseKey,
    text,
  });

  return created ? { clip: toSpeechClip(created), status: "ready" } : { status: "failed" };
}
