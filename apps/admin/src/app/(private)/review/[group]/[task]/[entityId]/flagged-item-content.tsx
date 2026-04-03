import {
  getCourseSuggestionReview,
  getSentenceAudioReview,
  getStepVisualReview,
  getWordAudioReview,
} from "@/data/review/get-review-item";
import { type ReviewTaskType, getVisualKindFromTaskType } from "@/lib/review-utils";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { notFound } from "next/navigation";
import { uploadSentenceAudioAction, uploadWordAudioAction } from "./_actions/upload-audio";
import { AudioEdit } from "./audio-edit";
import { CourseSuggestionEdit } from "./course-suggestion-edit";
import { StepSelectImageEdit } from "./step-select-image-edit";
import { StepVisualImageEdit } from "./step-visual-image-edit";

async function renderWordAudio(entityId: bigint) {
  const item = await getWordAudioReview(entityId);

  if (!item) {
    notFound();
  }

  return (
    <AudioEdit
      item={{
        audioUrl: item.audioUrl,
        id: item.id.toString(),
        label: "word",
        romanization: item.romanization,
        targetLanguage: item.targetLanguage,
        text: item.word,
      }}
      uploadAction={uploadWordAudioAction}
    />
  );
}

async function renderSentenceAudio(entityId: bigint) {
  const item = await getSentenceAudioReview(entityId);

  if (!item) {
    notFound();
  }

  return (
    <AudioEdit
      item={{
        audioUrl: item.audioUrl,
        id: item.id.toString(),
        label: "sentence",
        romanization: item.romanization,
        targetLanguage: item.targetLanguage,
        text: item.sentence,
      }}
      uploadAction={uploadSentenceAudioAction}
    />
  );
}

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

  if (taskType === "wordAudio") {
    return renderWordAudio(entityId);
  }

  if (taskType === "sentenceAudio") {
    return renderSentenceAudio(entityId);
  }

  notFound();
}
