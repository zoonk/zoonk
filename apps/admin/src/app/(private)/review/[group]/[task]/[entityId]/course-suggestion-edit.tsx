import { type getCourseSuggestionReview } from "@/data/review/get-review-item";
import { Badge } from "@zoonk/ui/components/badge";
import { Input } from "@zoonk/ui/components/input";
import { Textarea } from "@zoonk/ui/components/textarea";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import {
  addCourseSuggestionAction,
  updateCourseSuggestionAction,
} from "./_actions/course-suggestion";
import { RemoveSuggestionButton } from "./remove-suggestion-button";

type CourseSuggestionReviewData = NonNullable<
  Awaited<ReturnType<typeof getCourseSuggestionReview>>
>;

function SuggestionForm({
  suggestion,
  searchPromptId,
}: {
  suggestion: CourseSuggestionReviewData["suggestions"][number]["courseSuggestion"];
  searchPromptId: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b pb-4 last:border-b-0">
      <form action={updateCourseSuggestionAction} className="flex flex-col gap-3">
        <input type="hidden" name="suggestionId" value={suggestion.id} />

        <Input name="title" defaultValue={suggestion.title} aria-label="Title" />

        <Textarea
          name="description"
          defaultValue={suggestion.description}
          rows={3}
          aria-label="Description"
        />

        <div className="flex items-center justify-between">
          <SubmitButton className="self-start">Save</SubmitButton>

          <RemoveSuggestionButton
            searchPromptId={searchPromptId}
            courseSuggestionId={suggestion.id}
          />
        </div>
      </form>
    </div>
  );
}

function AddSuggestionForm({
  searchPromptId,
  language,
}: {
  searchPromptId: string;
  language: string;
}) {
  return (
    <form action={addCourseSuggestionAction} className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-medium">Add suggestion</h3>

      <input type="hidden" name="searchPromptId" value={searchPromptId} />
      <input type="hidden" name="language" value={language} />

      <Input name="title" placeholder="Title" aria-label="New suggestion title" />

      <Textarea
        name="description"
        placeholder="Description"
        rows={3}
        aria-label="New suggestion description"
      />

      <SubmitButton className="self-start">Add</SubmitButton>
    </form>
  );
}

export function CourseSuggestionEdit({ item }: { item: CourseSuggestionReviewData }) {
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
          <SuggestionForm
            key={courseSuggestion.id}
            suggestion={courseSuggestion}
            searchPromptId={item.id}
          />
        ))}
      </div>

      <AddSuggestionForm searchPromptId={item.id} language={item.language} />
    </div>
  );
}
