import { type CourseSuggestion } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";

export function CourseSuggestionReview({ item }: { item: CourseSuggestion }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{item.title}</h2>
      <p className="text-muted-foreground">{item.description}</p>

      <div className="flex gap-2">
        <Badge variant="outline">{item.language}</Badge>
        {item.targetLanguage && <Badge variant="outline">{item.targetLanguage}</Badge>}
      </div>
    </div>
  );
}
