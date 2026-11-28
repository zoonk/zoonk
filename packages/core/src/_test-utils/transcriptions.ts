import {
  NO_SPEECH_CHECK_MODEL,
  transcribeSpeech,
} from "@zoonk/ai/tasks/language/transcribe-speech";
import { vi } from "vitest";

/** Transcriptions that grade a recording; the no-speech check's aren't counted. */
export function gradingTranscriptions() {
  return vi
    .mocked(transcribeSpeech)
    .mock.calls.filter(([params]) => params.model !== NO_SPEECH_CHECK_MODEL);
}
