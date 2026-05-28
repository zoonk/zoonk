import { type getCourseSuggestionReview } from "@/data/review/get-review-item";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Textarea } from "@zoonk/ui/components/textarea";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import {
  addCourseSuggestionAction,
  moveCourseSuggestionAction,
  updateCourseSuggestionAction,
} from "./_actions/course-suggestion";
import { RemoveSuggestionButton } from "./remove-suggestion-button";

type CourseSuggestionReviewData = NonNullable<
  Awaited<ReturnType<typeof getCourseSuggestionReview>>
>;

type SuggestionLink = CourseSuggestionReviewData["suggestions"][number];

/**
 * Suggestions are sorted by their prompt-specific link, so each move form must
 * submit both IDs instead of updating the reusable course suggestion directly.
 */
function SortButton({
  courseSuggestionId,
  direction,
  disabled,
  label,
  searchPromptId,
}: {
  courseSuggestionId: string;
  direction: "up" | "down";
  disabled: boolean;
  label: string;
  searchPromptId: string;
}) {
  const Icon = direction === "up" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <form action={moveCourseSuggestionAction}>
      <input type="hidden" name="searchPromptId" value={searchPromptId} />
      <input type="hidden" name="courseSuggestionId" value={courseSuggestionId} />
      <input type="hidden" name="direction" value={direction} />

      <Button
        aria-label={label}
        disabled={disabled}
        size="icon-sm"
        title={label}
        type="submit"
        variant="outline"
      >
        <Icon />
      </Button>
    </form>
  );
}

function SuggestionForm({
  canMoveDown,
  canMoveUp,
  position,
  suggestionLink,
  searchPromptId,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  position: number;
  suggestionLink: SuggestionLink;
  searchPromptId: string;
}) {
  const suggestion = suggestionLink.courseSuggestion;

  return (
    <div className="flex gap-3 border-b pb-4 last:border-b-0">
      <div className="flex flex-col items-center gap-1 pt-1">
        <span className="text-muted-foreground w-8 text-center text-xs tabular-nums">
          {position}
        </span>

        <SortButton
          courseSuggestionId={suggestion.id}
          direction="up"
          disabled={!canMoveUp}
          label={`Move ${suggestion.title} up`}
          searchPromptId={searchPromptId}
        />

        <SortButton
          courseSuggestionId={suggestion.id}
          direction="down"
          disabled={!canMoveDown}
          label={`Move ${suggestion.title} down`}
          searchPromptId={searchPromptId}
        />
      </div>

      <form action={updateCourseSuggestionAction} className="flex min-w-0 flex-1 flex-col gap-3">
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

        {item.suggestions.map((suggestionLink, index) => (
          <SuggestionForm
            key={suggestionLink.courseSuggestion.id}
            canMoveDown={index < item.suggestions.length - 1}
            canMoveUp={index > 0}
            position={index + 1}
            suggestionLink={suggestionLink}
            searchPromptId={item.id}
          />
        ))}
      </div>

      <AddSuggestionForm searchPromptId={item.id} language={item.language} />
    </div>
  );
}
