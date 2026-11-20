// The learn adapters plus the speech player the main app provides around every screen.
import {
  SpeechPlayerProvider,
  type VoiceText,
} from "@repo/packages/learn/src/speech/speech-player-provider.tsx";
import { Learn } from "./shell";

const voice: VoiceText = async () => ({ limit: null, status: "failed" });

export function LangLearn({ children }: { children: React.ReactNode }) {
  return (
    <Learn>
      <SpeechPlayerProvider voice={voice}>{children}</SpeechPlayerProvider>
    </Learn>
  );
}
