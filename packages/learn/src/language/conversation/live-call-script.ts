import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";

export type LiveCallScript = LanguageConversationSetup["script"];

export type LiveCallCue = LiveCallScript["cues"]["opening"];

/** The setup's typed-reply cue ends where the reply goes, quoted so it reads as data. */
export function toTypedReplyCue(script: LiveCallScript, reply: string): LiveCallCue {
  const { channel, text } = script.cues.typedReply;
  return { channel, text: `${text}${JSON.stringify(reply)}` };
}
