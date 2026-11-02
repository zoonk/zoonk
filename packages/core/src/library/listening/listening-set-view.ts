import { type MediaAsset } from "@zoonk/db";
import { z } from "zod";
import { LISTENING_PLAYS, type ListeningContent } from "./listening-content";

export const listeningSetViewSchema = z.object({
  audio: z.object({ durationMs: z.number().int().nullable(), url: z.string() }).nullable(),
  plays: z.union([z.literal(LISTENING_PLAYS[0]), z.literal(LISTENING_PLAYS[1])]),
  task: z.string().nullable(),
  title: z.string().nullable(),
  transcript: z.array(z.object({ speaker: z.string(), text: z.string() })).nullable(),
});

export type ListeningSetView = z.infer<typeof listeningSetViewSchema>;

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
