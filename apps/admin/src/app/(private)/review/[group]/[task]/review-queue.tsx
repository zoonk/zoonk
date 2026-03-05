import { getNextReviewItem } from "@/data/review/get-next-review-item";
import { getCourseSuggestionReview, getStepVisualReview } from "@/data/review/get-review-item";
import { type ReviewTaskType, getTaskPath, getVisualKindFromTaskType } from "@/lib/review-utils";
import { parseBigIntId } from "@zoonk/utils/string";
import { redirect } from "next/navigation";
import { CourseSuggestionReview } from "../../_components/content/course-suggestion-review";
import { StepSelectImageReview } from "../../_components/content/step-select-image-review";
import { StepVisualImageReview } from "../../_components/content/step-visual-image-review";
import { ReviewActions } from "../../_components/review-actions";
import { ReviewEmpty } from "../../_components/review-empty";
import { ReviewProgress } from "../../_components/review-progress";

async function renderContent(taskType: ReviewTaskType, entityId: bigint) {
  const visualKind = getVisualKindFromTaskType(taskType);

  if (visualKind) {
    const item = await getStepVisualReview(entityId);
    if (!item) {
      return null;
    }
    return <StepVisualImageReview item={item} />;
  }

  if (taskType === "courseSuggestions") {
    const item = await getCourseSuggestionReview(entityId);
    return item ? <CourseSuggestionReview item={item} /> : null;
  }

  if (taskType === "stepSelectImage") {
    const item = await getStepVisualReview(entityId);
    if (!item) {
      return null;
    }
    return <StepSelectImageReview item={item} />;
  }

  return null;
}

export async function ReviewQueue({
  taskType,
  currentId,
}: {
  taskType: ReviewTaskType;
  currentId: string | undefined;
}) {
  const queue = await getNextReviewItem(taskType);
  const entityId = (currentId ? parseBigIntId(currentId) : null) ?? queue.entityId;

  if (!entityId) {
    return <ReviewEmpty />;
  }

  const content = await renderContent(taskType, entityId);

  if (!content) {
    redirect(getTaskPath(taskType));
  }

  return (
    <div className="flex flex-col gap-6">
      <ReviewProgress remaining={queue.remaining} />

      {content}

      <ReviewActions taskType={taskType} entityId={entityId.toString()} />
    </div>
  );
}
