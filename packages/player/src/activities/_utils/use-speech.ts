"use client";

import { getBaseLanguage } from "@zoonk/utils/languages";
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechStatus = "loading" | "ready" | "unavailable";

/** Browsers list their voices a moment after the page loads; after this, none is coming. */
const VOICE_WAIT_MS = 1500;

function hasSpeech(): boolean {
  return globalThis.speechSynthesis !== undefined;
}

function normalizeTag(tag: string): string {
  return tag.replaceAll("_", "-").toLowerCase();
}

/** A voice for the language: the exact region first ("es-ES"), then any of the language ("es"). */
function pickVoice<TVoice extends { default?: boolean; lang: string }>(
  voices: readonly TVoice[],
  language: string,
): TVoice | null {
  const wanted = normalizeTag(language);
  const base = getBaseLanguage(language);
  const exact = voices.filter((voice) => normalizeTag(voice.lang) === wanted);
  const sameLanguage = voices.filter((voice) => getBaseLanguage(voice.lang) === base);
  const candidates = exact.length > 0 ? exact : sameLanguage;

  return candidates.find((voice) => voice.default) ?? candidates[0] ?? null;
}

function speechStatus({ hasVoice, waited }: { hasVoice: boolean; waited: boolean }): SpeechStatus {
  if (hasVoice) {
    return "ready";
  }

  return waited ? "unavailable" : "loading";
}

/**
 * Reads text aloud with the device's own voices for the language, at any speed. The device says
 * whether it has a voice for the language (`status`), so activities can offer the words instead.
 */
export function useSpeech(language: string) {
  /* The canvas renders only in the browser, so reading the device's voices up front is safe. */
  const [voices, setVoices] = useState<SpeechSynthesisVoice[] | null>(() =>
    hasSpeech() ? globalThis.speechSynthesis.getVoices() : null,
  );

  const [waited, setWaited] = useState(() => !hasSpeech());
  const runRef = useRef(0);

  useEffect(() => {
    if (!hasSpeech()) {
      return;
    }

    const synth = globalThis.speechSynthesis;
    const update = () => setVoices(synth.getVoices());
    const timer = setTimeout(() => setWaited(true), VOICE_WAIT_MS);

    synth.addEventListener("voiceschanged", update);

    return () => {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", update);
      synth.cancel();
    };
  }, []);

  const voice = voices ? pickVoice(voices, language) : null;
  const status = speechStatus({ hasVoice: voice !== null, waited });

  const cancel = useCallback(() => {
    runRef.current += 1;

    if (hasSpeech()) {
      globalThis.speechSynthesis.cancel();
    }
  }, []);

  /**
   * Reads `segments` in order from `from`, calling `onSegment` as each one starts and `onDone`
   * after the last. A new call or `cancel` stops the previous reading without calling `onDone`.
   */
  const speak = useCallback(
    ({
      from = 0,
      onDone,
      onSegment,
      rate = 1,
      segments,
    }: {
      from?: number;
      onDone?: () => void;
      onSegment?: (index: number) => void;
      rate?: number;
      segments: readonly string[];
    }) => {
      cancel();

      if (!voice || !hasSpeech()) {
        return;
      }

      const run = runRef.current;
      const isCurrent = () => runRef.current === run;
      const last = segments.length - 1;

      segments.slice(from).forEach((text, offset) => {
        const index = from + offset;
        const utterance = new SpeechSynthesisUtterance(text);

        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        utterance.addEventListener("start", () => isCurrent() && onSegment?.(index));

        if (index === last) {
          utterance.addEventListener("end", () => isCurrent() && onDone?.());
        }

        globalThis.speechSynthesis.speak(utterance);
      });
    },
    [cancel, voice],
  );

  return { cancel, speak, status };
}
