import { getBaseLanguage, isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { languageCodeSchema } from "../library/steps/contract/content-schemas";

export const NEW_SPEECH_CLIP_MAX_CHARACTERS = 600;

export function normalizeSpeechText(text: string): string {
  return text.normalize("NFC").replaceAll(/\s+/gu, " ").trim();
}

export const speechClipInputSchema = z.object({
  language: languageCodeSchema
    .refine((language) => isTTSSupportedLanguage(getBaseLanguage(language)), {
      message: "There's no voice for this language",
    })
    .meta({ description: 'The language the text is in, such as "it", "es" or "pt-BR"' }),
  personal: z
    .boolean()
    .default(false)
    .meta({
      description:
        "The words are the learner's own (a better version of what they said in a call): the clip is kept for them alone, in their private files, never shared",
    }),
  text: z
    .string()
    .trim()
    .min(1)
    .meta({
      description:
        "What the clip says: a word, a sentence or a passage. New clips accept up to 600 characters; prepared recordings may be longer",
    }),
});

export type SpeechClipInput = z.input<typeof speechClipInputSchema>;

export const speechClipSchema = z.object({
  durationMs: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .meta({ description: "How long the clip plays, when known" }),
  id: z.uuid(),
  language: z.string(),
  url: z
    .url()
    .meta({
      description:
        "The MP3 file to play: a shared clip's public file, or a personal one's file route, which only its learner can read",
    }),
});

export type SpeechClip = z.infer<typeof speechClipSchema>;
