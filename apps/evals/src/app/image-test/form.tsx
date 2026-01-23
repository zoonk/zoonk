"use client";

import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { generateThumbnailAction } from "./actions";

export function ImageTestForm() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    imageUrl?: string;
    error?: string;
  } | null>(null);

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setResult(null);
      const response = await generateThumbnailAction(formData);

      if ("error" in response) {
        setResult({ error: response.error });
      } else if (response.success && response.imageUrl) {
        setResult({ imageUrl: response.imageUrl });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Course Title</Label>
          <Input
            disabled={isPending}
            id="title"
            name="title"
            placeholder="Enter a course title…"
            required
            type="text"
          />
        </div>

        <Button className="self-start" disabled={isPending} type="submit">
          {isPending && <Loader2 className="animate-spin" />}
          Generate Thumbnail
        </Button>
      </form>

      {result?.error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-500">
          <p className="font-medium">Error</p>
          <p className="text-sm">{result.error}</p>
        </div>
      )}

      {result?.imageUrl && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-medium">Generated Thumbnail</p>
            <Image
              alt="Generated course thumbnail"
              className="max-w-md rounded-lg border"
              height={1024}
              src={result.imageUrl}
              width={1024}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input className="font-mono text-sm" id="imageUrl" readOnly value={result.imageUrl} />
          </div>
        </div>
      )}
    </div>
  );
}
