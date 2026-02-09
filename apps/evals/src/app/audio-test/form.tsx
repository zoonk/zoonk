"use client";

import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zoonk/ui/components/select";
import { TTS_VOICES } from "@zoonk/utils/constants";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { generateAudioAction } from "./actions";

export function AudioTestForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    audioUrl?: string;
    error?: string;
  } | null>(null);

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setResult(null);
      const response = await generateAudioAction(formData);

      if ("error" in response) {
        setResult({ error: response.error });
      } else if (response.success && response.audioUrl) {
        setResult({ audioUrl: response.audioUrl });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="text">Text to speak</Label>
          <Input
            disabled={isPending}
            id="text"
            name="text"
            placeholder="Enter a word or sentence…"
            required
            type="text"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="voice">Voice</Label>
          <Select defaultValue="marin" name="voice">
            <SelectTrigger id="voice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TTS_VOICES.map((voice) => (
                <SelectItem key={voice} value={voice}>
                  {voice}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button className="self-start" disabled={isPending} type="submit">
          {isPending && <Loader2 className="animate-spin" />}
          Generate Audio
        </Button>
      </form>

      {result?.error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-500">
          <p className="font-medium">Error</p>
          <p className="text-sm">{result.error}</p>
        </div>
      )}

      {result?.audioUrl && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-medium">Generated Audio</p>
            {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- internal testing tool */}
            <audio controls src={result.audioUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="audioUrl">Audio URL</Label>
            <Input className="font-mono text-sm" id="audioUrl" readOnly value={result.audioUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
