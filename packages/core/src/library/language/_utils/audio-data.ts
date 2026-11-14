import { type SpeechProvenance } from "@zoonk/ai/tasks/audio";

export function toAudioData({ provenance, url }: { provenance: SpeechProvenance; url: string }) {
  return {
    audioGeneratedAt: new Date(provenance.generatedAt),
    audioModel: provenance.model,
    audioPromptVersion: provenance.promptVersion,
    audioRunId: provenance.runId,
    audioUrl: url,
  };
}
