import { type MediaAsset } from "@zoonk/db";
import { z } from "zod";
import { LISTENING_PLAYS, type ListeningContent } from "./listening-content";

/**
 * What a learner gets of a recording with its questions: the file to play, how many times it plays,
 * the exam part and the situation it stands for, and the transcript only once the set's questions
 * are answered (before, the script would answer them).
 */
export const listeningSetViewSchema = z.object({
  /** The voiced recording; null while it isn't voiced, which the set's pickers never serve. */
  audio: z.object({ durationMs: z.number().int().nullable(), url: z.string() }).nullable(),
  plays: z.union([z.literal(LISTENING_PLAYS[0]), z.literal(LISTENING_PLAYS[1])]),
  /** The exam part in the notice's words ("Part 1: a conversation in an everyday context"). */
  task: z.string().nullable(),
  title: z.string().nullable(),
  /** Who said what, in order, by the names the recording gives; null until answered. */
  transcript: z.array(z.object({ speaker: z.string(), text: z.string() })).nullable(),
});

export type ListeningSetView = z.infer<typeof listeningSetViewSchema>;

/** The view of an audio set, with its transcript when `reveal` (its questions are answered). */
export function toListeningSetView({
  content,
  mediaAsset,
  reveal,
}: {
  content: ListeningContent;
  mediaAsset: Pick<MediaAsset, "durationMs" | "url"> | null;
  reveal: boolean;
}): ListeningSetView {
  const labels = new Map(content.script.speakers.map((speaker) => [speaker.key, speaker.label]));

  return {
    audio: mediaAsset ? { durationMs: mediaAsset.durationMs, url: mediaAsset.url } : null,
    plays: content.plays,
    task: content.task,
    title: content.title,
    transcript: reveal
      ? content.script.turns.map((turn) => ({
          speaker: labels.get(turn.speaker) ?? turn.speaker,
          text: turn.text,
        }))
      : null,
  };
}
