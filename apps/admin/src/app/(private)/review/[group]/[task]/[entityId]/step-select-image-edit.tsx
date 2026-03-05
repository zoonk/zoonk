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

function SelectImageOption({
  option,
  index,
  stepId,
}: {
  option: { prompt: string; url?: string; feedback: string; isCorrect: boolean };
  index: number;
  stepId: string;
}) {
  const params = { imageTarget: index, stepId };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <ImageUploadProvider
        currentImageUrl={option.url ?? null}
        onRemove={noopRemove}
        onUpload={uploadStepImageAction.bind(null, params)}
      >
        <ImageUploadTrigger
          aria-label={
            option.url
              ? `Replace image for "${option.prompt}"`
              : `Upload image for "${option.prompt}"`
          }
          className="aspect-square w-full"
          size={undefined}
        >
          {option.url ? (
            <Image
              alt={option.prompt}
              className="object-contain transition-opacity group-hover:opacity-80"
              fill
              sizes="300px"
              src={option.url}
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

      <p className="text-muted-foreground text-sm">{option.prompt}</p>
      <p className="text-muted-foreground text-xs italic">{option.feedback}</p>

      <Badge variant={option.isCorrect ? "default" : "outline"}>
        {option.isCorrect ? "Correct" : "Incorrect"}
      </Badge>
    </div>
  );
}

export function StepSelectImageEdit({
  item,
}: {
  item: {
    id: string;
    content: {
      question: string;
      options: { prompt: string; url?: string; feedback: string; isCorrect: boolean }[];
    };
    activity: { title: string | null };
  };
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">selectImage</Badge>
        <span className="text-muted-foreground text-sm">{item.activity.title}</span>
      </div>

      <p className="text-lg font-medium">{item.content.question}</p>

      <div className="grid grid-cols-2 gap-4">
        {item.content.options.map((option, index) => (
          <SelectImageOption key={option.prompt} option={option} index={index} stepId={item.id} />
        ))}
      </div>
    </div>
  );
}
