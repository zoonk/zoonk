import { DeleteItemButton } from "@/components/navbar/delete-item-button";
import { PublishToggle } from "@/components/navbar/publish-toggle";
import { CourseActionsContainer } from "./course-actions-container";

export function CourseActionsSkeleton() {
  return (
    <CourseActionsContainer>
      <PublishToggle isPublished={false} />
      <DeleteItemButton />
    </CourseActionsContainer>
  );
}
