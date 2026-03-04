import { type StepVisualKind } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";

export function StepVisualReview({
  item,
}: {
  item: {
    id: bigint;
    visualKind: StepVisualKind | null;
    visualContent: unknown;
    activity: { title: string | null };
  };
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{item.visualKind}</Badge>
        <span className="text-muted-foreground text-sm">{item.activity.title}</span>
      </div>

      <pre className="bg-muted overflow-auto rounded-md p-4 text-sm">
        {JSON.stringify(item.visualContent, null, 2)}
      </pre>
    </div>
  );
}
