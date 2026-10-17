import { assignListeningVoices } from "@zoonk/ai/tasks/audio/listening-voices";
import { LISTENING_GENDERS, type ListeningSet } from "@zoonk/ai/tasks/v2/listening/schema";
import { TTS_VOICES } from "@zoonk/utils/languages";
import { z } from "zod";

/** How many times an exam plays a recording: once (IELTS, TOEFL) or twice (Cambridge, DELE). */
export const LISTENING_PLAYS = [1, 2] as const;

export type ListeningPlays = (typeof LISTENING_PLAYS)[number];

const listeningSpeakerSchema = z.object({
  /** The accent the voice was asked for, from the exam's list ("British English"). */
  accent: z.string(),
  gender: z.enum(LISTENING_GENDERS),
  /** What turns call the speaker by. */
  key: z.string(),
  /** How the transcript names the speaker ("Receptionist", "Tom"). */
  label: z.string(),
  voice: z.enum(TTS_VOICES),
});

/**
 * An audio set's stimulus (`ItemSet.content` for kind `audio`): the recording's script, which
 * learners read only as the transcript after answering, how many times the exam plays it, and the
 * part of the exam it stands for. The voiced file is `ItemSet.mediaAssetId`. Shared Library
 * content: written from the exam's task and level, never a learner's words.
 */
export const listeningContentSchema = z.object({
  plays: z.union([z.literal(LISTENING_PLAYS[0]), z.literal(LISTENING_PLAYS[1])]),
  script: z.object({
    speakers: z.array(listeningSpeakerSchema).min(1),
    turns: z.array(z.object({ speaker: z.string(), text: z.string() })).min(1),
  }),
  /** The recording's language, which can differ from the set's (the learner's, for reasons). */
  scriptLanguage: z.string(),
  /** The exam part, in the notice's words ("Part 1: a conversation in an everyday context"). */
  task: z.string().nullable(),
  title: z.string().nullable(),
});

export type ListeningContent = z.infer<typeof listeningContentSchema>;

/**
 * A written listening set's stimulus as it's stored: each speaker gets a voice that fits their
 * gender, different from the others' and fixed by the script (`assignListeningVoices`), so the
 * same script is always voiced the same way.
 */
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

  // An empty title said an answer (`repairListeningSet`): the player names it "Recording".
  return {
    plays,
    script: { speakers, turns: set.turns },
    scriptLanguage,
    task,
    title: set.title || null,
  };
}
