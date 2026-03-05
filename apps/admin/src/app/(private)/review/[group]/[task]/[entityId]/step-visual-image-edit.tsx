"use client";

import { Badge } from "@zoonk/ui/components/badge";
import {
  ImageUploadActionButton,
  ImageUploadLoading,
  ImageUploadOverlay,
  ImageUploadPlaceholder,
  ImageUploadProvider,
  ImageUploadTrigger,
} from "@zoonk/ui/components/image-upload";
import { ImageIcon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { uploadStepImageAction } from "./_actions/step-image";

const noopRemove = async () => ({ error: null });

export function StepVisualImageEdit({
  item,
}: {
  item: {
    id: string;
    visualContent: { prompt: string; url?: string };
    activity: { title: string | null };
  };
}) {
  const params = { imageTarget: "visual" as const, stepId: item.id };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">image</Badge>
        <span className="text-muted-foreground text-sm">{item.activity.title}</span>
      </div>

      <p className="text-muted-foreground font-mono text-sm">{item.visualContent.prompt}</p>

      <ImageUploadProvider
        currentImageUrl={item.visualContent.url ?? null}
        onRemove={noopRemove}
        onUpload={uploadStepImageAction.bind(null, params)}
      >
        <ImageUploadTrigger
          aria-label={item.visualContent.url ? "Replace image" : "Upload image"}
          className="h-96 w-full max-w-150"
          size={undefined}
        >
          {item.visualContent.url ? (
            <Image
              alt={item.visualContent.prompt}
              className="object-contain transition-opacity group-hover:opacity-80"
              fill
              sizes="600px"
              src={item.visualContent.url}
            />
          ) : (
            <ImageUploadPlaceholder>
              <ImageIcon />
            </ImageUploadPlaceholder>
          )}

          <ImageUploadOverlay>
            <ImageUploadActionButton>
              <UploadIcon />
            </ImageUploadActionButton>
          </ImageUploadOverlay>

          <ImageUploadLoading />
        </ImageUploadTrigger>
      </ImageUploadProvider>
    </div>
  );
}
