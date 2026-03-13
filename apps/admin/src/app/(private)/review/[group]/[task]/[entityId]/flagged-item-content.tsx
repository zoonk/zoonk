import { getCourseSuggestionReview, getStepVisualReview } from "@/data/review/get-review-item";
import { type ReviewTaskType, getVisualKindFromTaskType } from "@/lib/review-utils";
import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { notFound } from "next/navigation";
import { CourseSuggestionEdit } from "./course-suggestion-edit";
import { StepSelectImageEdit } from "./step-select-image-edit";
import { StepVisualImageEdit } from "./step-visual-image-edit";

export async function FlaggedItemContent({
  taskType,
  entityId,
}: {
  taskType: ReviewTaskType;
  entityId: bigint;
}) {
  const visualKind = getVisualKindFromTaskType(taskType);

  if (visualKind) {
    const step = await getStepVisualReview(entityId);

    if (!step) {
      notFound();
    }

    const visual = parseStepContent("visual", step.content);

    if (visual.kind !== "image") {
      notFound();
    }

    return (
      <StepVisualImageEdit
        item={{ activity: step.activity, content: visual, id: step.id.toString() }}
      />
    );
  }

  if (taskType === "stepSelectImage") {
    const step = await getStepVisualReview(entityId);

    if (!step) {
      notFound();
    }

    const content = parseStepContent("selectImage", step.content);
    return (
      <StepSelectImageEdit item={{ activity: step.activity, content, id: step.id.toString() }} />
    );
  }

  if (taskType === "courseSuggestions") {
    const item = await getCourseSuggestionReview(entityId);

    if (!item) {
      notFound();
    }

    return <CourseSuggestionEdit item={item} />;
  }

  notFound();
}
