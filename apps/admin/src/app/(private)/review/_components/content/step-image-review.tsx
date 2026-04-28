import { Badge } from "@zoonk/ui/components/badge";
import { isJsonObject } from "@zoonk/utils/json";
import Image from "next/image";

function getStringField(data: unknown, field: string): string | null {
  if (!isJsonObject(data)) {
    return null;
  }

  const value = data[field];
  return typeof value === "string" ? value : null;
}

export function StepImageReview({
  item,
}: {
  item: {
    id: string;
    content: unknown;
    lesson: { title: string };
  };
}) {
  const prompt = getStringField(item.content, "prompt");
  const imageUrl = getStringField(item.content, "url");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">image</Badge>
        <span className="text-muted-foreground text-sm">{item.lesson.title}</span>
      </div>

      {imageUrl && (
        <div className="flex justify-center">
          <Image
            src={imageUrl}
            alt={prompt ?? "AI generated image"}
            width={600}
            height={384}
            className="max-h-96 rounded-md object-contain"
          />
        </div>
      )}

      {prompt && <p className="text-muted-foreground font-mono text-sm">{prompt}</p>}
    </div>
  );
}
