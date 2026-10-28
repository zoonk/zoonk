import { assignListeningVoices } from "@zoonk/ai/tasks/audio/listening-voices";
import { LISTENING_GENDERS, type ListeningSet } from "@zoonk/ai/tasks/v2/listening/schema";
import { TTS_VOICES } from "@zoonk/utils/languages";
import { z } from "zod";

export const LISTENING_PLAYS = [1, 2] as const;

export type ListeningPlays = (typeof LISTENING_PLAYS)[number];

const listeningSpeakerSchema = z.object({
  accent: z.string(),
  gender: z.enum(LISTENING_GENDERS),
  key: z.string(),
  label: z.string(),
  voice: z.enum(TTS_VOICES),
});

export const listeningContentSchema = z.object({
  plays: z.union([z.literal(LISTENING_PLAYS[0]), z.literal(LISTENING_PLAYS[1])]),
  script: z.object({
    speakers: z.array(listeningSpeakerSchema).min(1),
    turns: z.array(z.object({ speaker: z.string(), text: z.string() })).min(1),
  }),
  scriptLanguage: z.string(),
  task: z.string().nullable(),
  title: z.string().nullable(),
});

export type ListeningContent = z.infer<typeof listeningContentSchema>;

export function toListeningContent({
  plays,
  scriptLanguage,
  set,
  task,
}: {
  plays: ListeningPlays;
  scriptLanguage: string;
  set: ListeningSet;
  task: string | null;
}): ListeningContent {
  const seed = set.turns.map((turn) => turn.text).join("\n");

  const speakers = assignListeningVoices({ seed, speakers: set.speakers }).map((speaker) => ({
    accent: speaker.accent,
    gender: speaker.gender,
    key: speaker.name,
    label: speaker.name,
    voice: speaker.voice,
  }));

  return {
    plays,
    script: { speakers, turns: set.turns },
    scriptLanguage,
    task,
    title: set.title || null,
  };
}
