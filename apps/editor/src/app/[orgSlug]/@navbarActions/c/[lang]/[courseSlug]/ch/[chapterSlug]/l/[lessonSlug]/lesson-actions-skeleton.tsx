import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { LessonActionsContainer } from "./lesson-actions-container";

export function LessonActionsSkeleton() {
  return (
    <LessonActionsContainer>
      <PublishToggle isPublished={false} />
      <DeleteItemButton />
    </LessonActionsContainer>
  );
}
