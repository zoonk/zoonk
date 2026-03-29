"use client";

import { PlayAudioInline } from "@/app/(private)/review/_components/play-audio-inline";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { DEFAULT_AUDIO_ACCEPTED_TYPES } from "@zoonk/utils/upload";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";

type UploadAction = (
  params: { entityId: string },
  formData: FormData,
) => Promise<{ error: string | null }>;

export function AudioEdit({
  item,
  uploadAction,
}: {
  item: {
    id: string;
    text: string;
    label: string;
    audioUrl: string | null;
    targetLanguage: string;
    romanization: string | null;
  };
  uploadAction: UploadAction;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(item.audioUrl);
  const blobUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadAction({ entityId: item.id }, formData);

      if (result.error) {
        setError(result.error);
      } else {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const newUrl = URL.createObjectURL(file);
        blobUrlRef.current = newUrl;
        setCurrentAudioUrl(newUrl);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{item.label}</Badge>
        <span className="text-muted-foreground text-sm">{item.targetLanguage}</span>
      </div>

      <p className="text-2xl font-semibold">{item.text}</p>

      {item.romanization && <p className="text-muted-foreground text-sm">{item.romanization}</p>}

      {currentAudioUrl && (
        <div className="flex justify-center py-4">
          <PlayAudioInline audioUrl={currentAudioUrl} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="relative">
          <input
            ref={fileInputRef}
            accept={DEFAULT_AUDIO_ACCEPTED_TYPES.join(",")}
            className="sr-only"
            disabled={isPending}
            onChange={handleUpload}
            type="file"
          />

          <Button
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            {isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
            Upload replacement audio
          </Button>
        </label>

        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    </div>
  );
}
