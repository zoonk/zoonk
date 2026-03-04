import { getNextReviewItem } from "@/data/review/get-next-review-item";
import {
  getCourseSuggestionReview,
  getStepVisualReview,
  getWordAudioReview,
} from "@/data/review/get-review-item";
import { type ReviewTaskType, getTaskPath } from "@/lib/review-utils";
import { redirect } from "next/navigation";
import { CourseSuggestionReview } from "../../_components/content/course-suggestion-review";
import { StepVisualImageReview } from "../../_components/content/step-visual-image-review";
import { StepVisualReview } from "../../_components/content/step-visual-review";
import { WordAudioReview } from "../../_components/content/word-audio-review";
import { ReviewActions } from "../../_components/review-actions";
import { ReviewEmpty } from "../../_components/review-empty";
import { ReviewProgress } from "../../_components/review-progress";

function parseSkipIds(raw: string | string[] | undefined): bigint[] {
  if (!raw) {
    return [];
  }
  const value = typeof raw === "string" ? raw : raw[0];
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .filter(Boolean)
    .map((id) => BigInt(id));
}

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
  searchParams,
}: {
  taskType: ReviewTaskType;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await searchParams;
  const currentIdRaw = typeof resolvedParams.current === "string" ? resolvedParams.current : null;
  const skipIds = parseSkipIds(resolvedParams.skipped);

  const queue = await getNextReviewItem(taskType, skipIds);
  const entityId = currentIdRaw ? BigInt(currentIdRaw) : queue.entityId;

  if (!entityId) {
    return <ReviewEmpty />;
  }

  const content = await renderContent(taskType, entityId);

  if (!content) {
    redirect(getTaskPath(taskType));
  }

  const newSkipped = [...skipIds, entityId].join(",");
  const skipUrl = `${getTaskPath(taskType)}?skipped=${newSkipped}`;

  return (
    <div className="flex flex-col gap-6">
      <ReviewProgress reviewed={queue.reviewed} total={queue.total} />

      {content}

      <ReviewActions taskType={taskType} entityId={entityId.toString()} skipUrl={skipUrl} />
    </div>
  );
}
