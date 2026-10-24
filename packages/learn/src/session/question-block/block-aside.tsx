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

/**
 * The block's aside from `lg`: the text, case, chart or recording the question in view shares with
 * its set, which its question places there (half the screen for a long text), or else the day's
 * queue, so the column never jumps from one question to the next. A question's own context stays
 * above it in the column.
 */
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
