"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { uploadStepImageAction } from "./_actions/step-image";
import { SimpleImageUpload } from "./simple-image-upload";

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
      <SimpleImageUpload
        alt={option.prompt}
        buttonLabel="Upload replacement image"
        imageClassName="aspect-square w-full rounded-md object-contain"
        initialImageUrl={option.url}
        placeholderClassName="aspect-square w-full"
        uploadAction={uploadStepImageAction.bind(null, params)}
      />

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
