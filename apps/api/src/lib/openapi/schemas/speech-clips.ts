import { speechClipInputSchema, speechClipSchema } from "@zoonk/core/audio/speech-clip-contract";

export const speechClipRequestSchema = speechClipInputSchema.meta({ id: "SpeechClipRequest" });

export const speechClipResponseSchema = speechClipSchema.meta({
  description:
    "A clip of the text read aloud in its language, shared by everyone who asks for it, or the learner's own when they asked for their own words (`personal`)",
  id: "SpeechClip",
});
