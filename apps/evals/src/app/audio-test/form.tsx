"use client";

import { LabeledSelect } from "@/components/labeled-select";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { MainSubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { TTS_VOICES } from "@zoonk/utils/languages";
import { useActionState } from "react";
import { generateAudioAction } from "./actions";
import { AUDIO_MODEL_OPTIONS, DEFAULT_AUDIO_MODEL_VALUE } from "./models";

const VOICE_OPTIONS = TTS_VOICES.map((voice) => ({ label: voice, value: voice }));

type AudioTestResult = { audioUrl?: string; error?: string };

function AudioTestFields({ disabled }: { disabled: boolean }) {
  return (
    <div className="max-w-column flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="text">Text to speak</Label>
        <Input
          disabled={disabled}
          id="text"
          name="text"
          placeholder="Enter a word or sentence…"
          required
          type="text"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="language">Language code</Label>
        <Input
          disabled={disabled}
          id="language"
          name="language"
          placeholder="e.g. en, es, fr, pt, ja"
          required
          type="text"
        />
      </div>

      <LabeledSelect
        defaultValue={DEFAULT_AUDIO_MODEL_VALUE}
        disabled={disabled}
        id="model"
        label="Model"
        name="model"
        options={AUDIO_MODEL_OPTIONS}
        triggerClassName="w-full"
      />

      <LabeledSelect
        defaultValue="Kore"
        disabled={disabled}
        id="voice"
        label="Voice (Gemini models only)"
        name="voice"
        options={VOICE_OPTIONS}
        triggerClassName="w-full"
      />
    </div>
  );
}

export function AudioTestForm() {
  const [result, formAction, isPending] = useActionState(
    async (_previous: AudioTestResult | null, formData: FormData): Promise<AudioTestResult> => {
      const response = await generateAudioAction(formData).catch(() => ({
        error: "The server couldn't be reached.",
      }));

      return "error" in response ? { error: response.error } : { audioUrl: response.audioUrl };
    },
    null,
  );

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6">
        <AudioTestFields disabled={isPending} />

        {result?.audioUrl && (
          <div className="max-w-column flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- internal testing tool */}
              <audio controls src={result.audioUrl}>
                Your browser does not support the audio element.
              </audio>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="audioUrl">Audio file</Label>
              <Input className="font-mono text-sm" id="audioUrl" readOnly value={result.audioUrl} />
            </div>
          </div>
        )}
      </div>

      <BottomBar
        note={
          result?.error && (
            <p className="text-destructive-text" role="alert">
              {result.error}
            </p>
          )
        }
      >
        <BottomBarActions>
          <MainSubmitButton className="lg:w-auto">Generate audio</MainSubmitButton>
        </BottomBarActions>
      </BottomBar>
    </form>
  );
}
