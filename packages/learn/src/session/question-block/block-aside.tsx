"use client";

import { useExtracted } from "next-intl";
import { type QuestionTutor } from "../../questions/question-tutor";
import { type TaskFrameAside } from "../../shell/task-frame";
import { type StudyQuestion } from "../session-types";
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
  question,
  tutor,
}: {
  question: StudyQuestion | null;
  tutor?: QuestionTutor | null;
}): TaskFrameAside {
  const t = useExtracted();
  const materialTitle = useMaterialTitle();

  const material = question ? getQuestionMaterial(question) : null;
  const help = { children: tutor?.aside, meta: tutor?.asideMeta(null) };

  if (!material) {
    return { ...help, label: t("Help with this question") };
  }

  return {
    ...help,
    label: t("What the question is about"),
    title: materialTitle(material.kind),
    width: material.long ? "half" : "default",
  };
}
