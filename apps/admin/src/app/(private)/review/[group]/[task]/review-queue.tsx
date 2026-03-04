import { getNextReviewItem } from "@/data/review/get-next-review-item";
import {
  getCourseSuggestionReview,
  getStepVisualReview,
  getWordAudioReview,
} from "@/data/review/get-review-item";
import { type ReviewTaskType, getTaskPath } from "@/lib/review-utils";
import { parseBigIntId } from "@zoonk/utils/string";
import { redirect } from "next/navigation";
import { CourseSuggestionReview } from "../../_components/content/course-suggestion-review";
import { StepVisualImageReview } from "../../_components/content/step-visual-image-review";
import { StepVisualReview } from "../../_components/content/step-visual-review";
import { WordAudioReview } from "../../_components/content/word-audio-review";
import { ReviewActions } from "../../_components/review-actions";
import { ReviewEmpty } from "../../_components/review-empty";
import { ReviewProgress } from "../../_components/review-progress";

async function renderContent(taskType: ReviewTaskType, entityId: bigint) {
  switch (taskType) {
    case "courseSuggestions": {
      const item = await getCourseSuggestionReview(entityId);
      return item ? <CourseSuggestionReview item={item} /> : null;
    }

    case "stepVisual": {
      const item = await getStepVisualReview(entityId);
      return item ? <StepVisualReview item={item} /> : null;
    }

    case "stepVisualImage": {
      const item = await getStepVisualReview(entityId);
      return item ? <StepVisualImageReview item={item} /> : null;
    }

    case "wordAudio": {
      const item = await getWordAudioReview(entityId);
      return item ? <WordAudioReview item={item} /> : null;
    }

    default:
      return null;
  }
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
