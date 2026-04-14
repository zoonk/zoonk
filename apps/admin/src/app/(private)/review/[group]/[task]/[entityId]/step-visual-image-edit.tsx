"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { uploadStepImageAction } from "./_actions/step-image";
import { SimpleImageUpload } from "./simple-image-upload";

export function StepVisualImageEdit({
  item,
}: {
  item: {
    id: string;
    content: { prompt: string; url?: string };
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

      <p className="text-muted-foreground font-mono text-sm">{item.content.prompt}</p>

      <SimpleImageUpload
        alt={item.content.prompt}
        buttonLabel="Upload replacement image"
        imageClassName="max-h-96 rounded-md object-contain"
        imageWrapperClassName="flex justify-center"
        initialImageUrl={item.content.url}
        placeholderClassName="h-96 w-full max-w-[600px]"
        uploadAction={uploadStepImageAction.bind(null, params)}
      />
    </div>
  );
}
