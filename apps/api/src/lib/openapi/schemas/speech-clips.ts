import { speechClipInputSchema, speechClipSchema } from "@zoonk/core/audio/speech-clip-contract";

export const speechClipRequestSchema = speechClipInputSchema.meta({ id: "SpeechClipRequest" });

export const speechClipResponseSchema = speechClipSchema.meta({
  description: "A clip of the text read aloud in its language, shared by everyone who asks for it",
  id: "SpeechClip",
});
