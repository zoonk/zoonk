import { type getCourseSuggestionReview } from "@/data/review/get-review-item";
import { Badge } from "@zoonk/ui/components/badge";

function statusVariant(status: string) {
  switch (status) {
    case "completed":
      return "default" as const;
    case "running":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export function CourseSuggestionReview({
  item,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getCourseSuggestionReview>>>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">{item.prompt}</h2>
        <Badge variant="outline">{item.language}</Badge>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
          Suggestions ({item.suggestions.length})
        </h3>

        {item.suggestions.map(({ courseSuggestion }) => (
          <div
            key={courseSuggestion.id}
            className="flex flex-col gap-1 border-b pb-4 last:border-b-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{courseSuggestion.title}</span>

              <Badge variant={statusVariant(courseSuggestion.generationStatus)}>
                {courseSuggestion.generationStatus}
              </Badge>
            </div>

            <p className="text-muted-foreground text-sm">{courseSuggestion.description}</p>

            <div className="flex flex-wrap gap-2">
              {courseSuggestion.targetLanguage && (
                <Badge variant="outline">{courseSuggestion.targetLanguage}</Badge>
              )}

              {courseSuggestion.generationRunId && (
                <span className="text-muted-foreground font-mono text-xs">
                  {courseSuggestion.generationRunId}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
