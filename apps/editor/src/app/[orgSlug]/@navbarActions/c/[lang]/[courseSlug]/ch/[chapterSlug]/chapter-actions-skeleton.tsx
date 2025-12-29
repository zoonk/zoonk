import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { ChapterActionsContainer } from "./chapter-actions-container";

export function ChapterActionsSkeleton() {
  return (
    <ChapterActionsContainer>
      <PublishToggle isPublished={false} />
      <DeleteItemButton />
    </ChapterActionsContainer>
  );
}
