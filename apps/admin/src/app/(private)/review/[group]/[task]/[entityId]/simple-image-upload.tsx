"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { DEFAULT_IMAGE_ACCEPTED_TYPES } from "@zoonk/utils/upload";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

type UploadAction = (formData: FormData) => Promise<{ error: string | null }>;

/**
 * Keeps the admin review image editing flow simple.
 *
 * Reviewers only need two things here: a large preview they can actually inspect
 * and a direct way to replace the file. This component uses a normal image tag
 * plus a native file input behind one outline button, so the admin app does not
 * depend on the smaller shared upload widget layout.
 */
export function SimpleImageUpload({
  alt,
  buttonLabel,
  imageClassName,
  imageWrapperClassName,
  initialImageUrl,
  placeholderClassName,
  uploadAction,
}: {
  alt: string;
  buttonLabel: string;
  imageClassName: string;
  imageWrapperClassName?: string;
  initialImageUrl?: string | null;
  placeholderClassName: string;
  uploadAction: UploadAction;
}) {
  const [currentImageUrl, setCurrentImageUrl] = useState(initialImageUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const blobUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    },
    [],
  );

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadAction(formData);

      if (result.error) {
        setError(result.error);
      } else {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const nextImageUrl = URL.createObjectURL(file);
        blobUrlRef.current = nextImageUrl;
        setCurrentImageUrl(nextImageUrl);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {currentImageUrl ? (
        <div className={cn(imageWrapperClassName)}>
          {/* oxlint-disable-next-line next/no-img-element -- internal admin preview needs direct blob URL support */}
          <img alt={alt} className={imageClassName} src={currentImageUrl} />
        </div>
      ) : (
        <div
          className={cn(
            "bg-muted text-muted-foreground flex items-center justify-center rounded-md",
            placeholderClassName,
          )}
        >
          <ImageIcon className="size-8" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="w-fit">
          <input
            ref={fileInputRef}
            accept={DEFAULT_IMAGE_ACCEPTED_TYPES.join(",")}
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
            {buttonLabel}
          </Button>
        </label>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    </div>
  );
}
