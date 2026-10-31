"use client";

import { useExtracted } from "next-intl";
import { type TaskFrameAside } from "../../shell/task-frame";
import { useSessionQueueAside } from "../session-queue";
import { getSessionQueue } from "../session-queue-rows";
import { type StudyBlockDetail, type StudyQuestion, type StudySession } from "../session-types";
import { type QuestionMaterialKind, getQuestionMaterial } from "./question-material";

function useMaterialTitle() {
  const t = useExtracted();

  return (kind: QuestionMaterialKind): string => {
    const titles: Record<QuestionMaterialKind, string> = {
      audio: t("Recording"),
      case: t("Case"),
      chart: t("Chart"),
      text: t("Text"),
    };

    return titles[kind];
  };
}

export function useBlockAside({
  detail,
  question,
  session,
}: {
  detail: StudyBlockDetail;
  question: StudyQuestion | null;
  session: Pick<StudySession, "blocks">;
}): TaskFrameAside {
  const t = useExtracted();
  const materialTitle = useMaterialTitle();

  const queue = useSessionQueueAside(
    getSessionQueue({ blocks: session.blocks, nextId: detail.block.id }),
  );

  const material = question ? getQuestionMaterial(question) : null;

  if (!material) {
    return queue;
  }

  return {
    label: t("What the question is about"),
    title: materialTitle(material.kind),
    width: material.long ? "half" : "default",
  };
}
