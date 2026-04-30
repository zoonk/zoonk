"use client";

import { getAdminLessonLabel } from "@/lib/lesson-label";
import { type LessonKind } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";
import { uploadStepImageAction } from "./_actions/step-image";
import { SimpleImageUpload } from "./simple-image-upload";

export function StepImageEdit({
  item,
}: {
  item: {
    id: string;
    content: { prompt: string; url?: string };
    lesson: { kind: LessonKind; title: string | null };
  };
}) {
  const params = { imageTarget: "step" as const, stepId: item.id };
  const lessonLabel = getAdminLessonLabel(item.lesson);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">image</Badge>
        <span className="text-muted-foreground text-sm">{lessonLabel}</span>
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
