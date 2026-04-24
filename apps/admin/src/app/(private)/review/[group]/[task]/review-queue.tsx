import { getNextReviewItem } from "@/data/review/get-next-review-item";
import {
  getCourseSuggestionReview,
  getSentenceAudioReview,
  getStepImageReview,
  getWordAudioReview,
} from "@/data/review/get-review-item";
import { type ReviewTaskType, getTaskPath } from "@/lib/review-utils";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { redirect } from "next/navigation";
import { AudioReview } from "../../_components/content/audio-review";
import { CourseSuggestionReview } from "../../_components/content/course-suggestion-review";
import { StepImageReview } from "../../_components/content/step-image-review";
import { StepSelectImageReview } from "../../_components/content/step-select-image-review";
import { ReviewActions } from "../../_components/review-actions";
import { ReviewEmpty } from "../../_components/review-empty";
import { ReviewProgress } from "../../_components/review-progress";

async function renderContent(taskType: ReviewTaskType, entityId: string) {
  if (taskType === "stepImage") {
    const item = await getStepImageReview(entityId);
    if (!item) {
      return null;
    }

    const content = parseStepContent("static", item.content);

    if (!content.image) {
      return null;
    }

    return <StepImageReview item={{ ...item, content: content.image }} />;
  }

  if (taskType === "courseSuggestions") {
    const item = await getCourseSuggestionReview(entityId);
    return item ? <CourseSuggestionReview item={item} /> : null;
  }

  if (taskType === "stepSelectImage") {
    const item = await getStepImageReview(entityId);
    if (!item) {
      return null;
    }
    return <StepSelectImageReview item={item} />;
  }

  if (taskType === "wordAudio") {
    const item = await getWordAudioReview(entityId);
    return item ? <AudioReview item={{ ...item, label: "word", text: item.word }} /> : null;
  }

  if (taskType === "sentenceAudio") {
    const item = await getSentenceAudioReview(entityId);
    return item ? <AudioReview item={{ ...item, label: "sentence", text: item.sentence }} /> : null;
  }

  return null;
}

export async function ReviewQueue({
  taskType,
  currentId,
}: {
  taskType: ReviewTaskType;
  currentId?: string;
}) {
  const queue = await getNextReviewItem(taskType);
  const entityId = currentId ?? queue.entityId;

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

      <ReviewActions taskType={taskType} entityId={entityId} />
    </div>
  );
}
