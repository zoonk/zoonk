import { Badge } from "@zoonk/ui/components/badge";
import { isJsonObject } from "@zoonk/utils/json";

function getStringField(data: unknown, field: string): string | null {
  if (!isJsonObject(data)) {
    return null;
  }

  const value = data[field];
  return typeof value === "string" ? value : null;
}

export function StepVisualImageReview({
  item,
}: {
  item: {
    id: bigint;
    visualContent: unknown;
    activity: { title: string | null };
  };
}) {
  const prompt = getStringField(item.visualContent, "prompt");
  const imageUrl = getStringField(item.visualContent, "url");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">image</Badge>
        <span className="text-muted-foreground text-sm">{item.activity.title}</span>
      </div>

      {imageUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={prompt ?? "AI generated image"}
            className="max-h-96 rounded-md object-contain"
          />
        </div>
      )}

      {prompt && <p className="text-muted-foreground font-mono text-sm">{prompt}</p>}
    </div>
  );
}
