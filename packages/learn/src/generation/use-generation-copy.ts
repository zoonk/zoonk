"use client";

import { useExtracted } from "next-intl";
import {
  useConversationCallCopy,
  useExamSpeakingCopy,
  useSpeakingMockCopy,
  useSpeakingPaperCopy,
} from "./call-generation-copy";
import { type KindCopy } from "./generation-copy-types";
import { type GenerationKind } from "./generation-kinds";
import { useLessonCopy } from "./lesson-generation-copy";

function useGoalPhaseCopy() {
  const t = useExtracted();

  return {
    goal: t("Reading your goal"),
    // The `notice` phase only runs for a test built from the learner's own material.
    notice: t("Reading your material"),
    skills: t("Choosing what to learn"),
  } satisfies Record<string, string>;
}

function useUnderstandingCopy(): KindCopy<"understanding"> {
  const t = useExtracted();

  return {
    name: t("Reading your goal"),
    phases: { dates: t("Checking the exam dates"), read: t("Reading your goal") },
  };
}

function useCurriculumCopy(): KindCopy<"curriculum"> {
  const t = useExtracted();
  const goal = useGoalPhaseCopy();

  return {
    name: t("Building your plan"),
    phases: { ...goal, plan: t("Fitting it into your days") },
  };
}

function usePlacementCopy(): KindCopy<"placement"> {
  const t = useExtracted();
  const goal = useGoalPhaseCopy();

  return {
    name: t("Getting your test ready"),
    phases: { ...goal, questions: t("Getting your questions ready") },
  };
}

function useFirstLessonCopy(): KindCopy<"firstLesson"> {
  const t = useExtracted();
  const goal = useGoalPhaseCopy();

  return {
    name: t("Getting your first day ready"),
    phases: { ...goal, day: t("Planning your first day") },
  };
}

function useCourseOutlineCopy(): KindCopy<"courseOutline"> {
  const t = useExtracted();
  const { skills } = useGoalPhaseCopy();

  return {
    name: t("Outlining your courses"),
    phases: { outline: t("Outlining your courses"), plan: t("Choosing your courses"), skills },
  };
}

function useLevelTestBankCopy(): KindCopy<"levelTestBank"> {
  const t = useExtracted();

  return {
    name: t("Getting your level test ready"),
    phases: { bank: t("Getting the questions ready") },
  };
}

function useExplanationCopy(): KindCopy<"explanation"> {
  const t = useExtracted();

  return {
    name: t("Writing your explanation"),
    phases: {
      find: t("Looking for an answer"),
      read: t("Reading your question"),
      write: t("Writing your explanation"),
    },
  };
}

function useTestOutQuestionsCopy(): KindCopy<"testOutQuestions"> {
  const t = useExtracted();

  return {
    name: t("Writing your questions"),
    phases: { questions: t("Writing questions on this chapter") },
  };
}

function useChallengeQuestionsCopy(): KindCopy<"challengeQuestions"> {
  const t = useExtracted();

  return {
    name: t("Writing your challenge"),
    phases: { questions: t("Writing questions on what you studied") },
  };
}

function useMockQuestionsCopy(): KindCopy<"mockQuestions"> {
  const t = useExtracted();

  return {
    name: t("Writing your mock exam"),
    phases: { questions: t("Writing questions like the exam's") },
  };
}

function useSetupLessonCopy(): KindCopy<"setupLesson"> {
  const t = useExtracted();

  return {
    name: t("Adding a setup lesson"),
    phases: { write: t("Writing the setup for your device") },
  };
}

/** Hooks can't be skipped, so every kind's copy is built and the wait reads its own. */
export function useGenerationCopy(kind: GenerationKind): {
  name: string;
  phases: Record<string, string>;
} {
  const copy = {
    challengeQuestions: useChallengeQuestionsCopy(),
    conversationCall: useConversationCallCopy(),
    courseOutline: useCourseOutlineCopy(),
    curriculum: useCurriculumCopy(),
    examSpeaking: useExamSpeakingCopy(),
    explanation: useExplanationCopy(),
    firstLesson: useFirstLessonCopy(),
    lesson: useLessonCopy(),
    levelTestBank: useLevelTestBankCopy(),
    mockQuestions: useMockQuestionsCopy(),
    placement: usePlacementCopy(),
    setupLesson: useSetupLessonCopy(),
    speakingMock: useSpeakingMockCopy(),
    speakingPaper: useSpeakingPaperCopy(),
    testOutQuestions: useTestOutQuestionsCopy(),
    understanding: useUnderstandingCopy(),
  } satisfies { [Kind in GenerationKind]: KindCopy<Kind> };

  return copy[kind];
}
