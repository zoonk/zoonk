import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { Badge } from "@zoonk/ui/components/badge";
import Image from "next/image";

export function StepSelectImageReview({
  item,
}: {
  item: {
    id: string;
    content: unknown;
    activity: { title: string | null };
  };
}) {
  const content = parseStepContent("selectImage", item.content);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">selectImage</Badge>
        <span className="text-muted-foreground text-sm">{item.activity.title}</span>
      </div>

      <p className="text-lg font-medium">{content.question}</p>

      <div className="grid grid-cols-2 gap-4">
        {content.options.map((option) => (
          <div key={option.prompt} className="flex flex-col gap-2 rounded-md border p-3">
            {option.url && (
              <Image
                src={option.url}
                alt={option.prompt}
                width={300}
                height={300}
                className="aspect-square w-full rounded-md object-contain"
              />
            )}

            <p className="text-muted-foreground text-sm">{option.prompt}</p>

            <Badge variant={option.isCorrect ? "default" : "outline"}>
              {option.isCorrect ? "Correct" : "Incorrect"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
