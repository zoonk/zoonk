import {
  getCourseSuggestionReview,
  getSentenceAudioReview,
  getStepImageReview,
  getWordAudioReview,
} from "@/data/review/get-review-item";
import { type ReviewTaskType } from "@/lib/review-utils";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { notFound } from "next/navigation";
import { uploadSentenceAudioAction, uploadWordAudioAction } from "./_actions/upload-audio";
import { AudioEdit } from "./audio-edit";
import { CourseSuggestionEdit } from "./course-suggestion-edit";
import { StepImageEdit } from "./step-image-edit";
import { StepSelectImageEdit } from "./step-select-image-edit";

async function renderWordAudio(entityId: string) {
  const item = await getWordAudioReview(entityId);

  if (!item) {
    notFound();
  }

  return (
    <AudioEdit
      item={{
        audioUrl: item.audioUrl,
        id: item.id,
        label: "word",
        romanization: item.romanization,
        targetLanguage: item.targetLanguage,
        text: item.word,
      }}
      uploadAction={uploadWordAudioAction}
    />
  );
}

async function renderSentenceAudio(entityId: string) {
  const item = await getSentenceAudioReview(entityId);

  if (!item) {
    notFound();
  }

  return (
    <AudioEdit
      item={{
        audioUrl: item.audioUrl,
        id: item.id,
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
  entityId: string;
}) {
  if (taskType === "stepImage") {
    const step = await getStepImageReview(entityId);

    if (!step) {
      notFound();
    }

    const content = parseStepContent("static", step.content);

    if (!content.image) {
      notFound();
    }

    return (
      <StepImageEdit item={{ activity: step.activity, content: content.image, id: step.id }} />
    );
  }

  if (taskType === "stepSelectImage") {
    const step = await getStepImageReview(entityId);

    if (!step) {
      notFound();
    }

    const content = parseStepContent("selectImage", step.content);
    return <StepSelectImageEdit item={{ activity: step.activity, content, id: step.id }} />;
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
