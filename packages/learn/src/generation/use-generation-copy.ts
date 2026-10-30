"use client";

import { useExtracted } from "next-intl";
import { type NumberedLines } from "./_utils/detail-line";
import {
  useConversationCallCopy,
  useExamSpeakingCopy,
  useSpeakingMockCopy,
} from "./call-generation-copy";
import { type KindCopy, type PhaseCopy } from "./generation-copy-types";
import { type GenerationKind } from "./generation-kinds";

function useQuestionLines() {
  const t = useExtracted();

  return ({ count }: { count: number }): NumberedLines => ({
    count,
    line: (number) => t("Writing question {number}…", { number: String(number) }),
    review: t("Checking the answers…"),
  });
}

function useGoalPhaseCopy() {
  const t = useExtracted();

  return {
    goal: {
      label: t("Reading your goal"),
      lines: [t("Reading your answers…"), t("Deciding how deep to go…")],
    },
    // The `notice` phase only runs for a test built from the learner's own material.
    notice: {
      label: t("Reading your material"),
      lines: [t("Finding the topics it covers…"), t("Putting them in the order it teaches…")],
    },
    skills: {
      label: t("Mapping the skills it takes"),
      lines: [
        t("Listing what your goal asks for…"),
        t("Putting the skills in order…"),
        t("Checking nothing important is missing…"),
      ],
    },
  } satisfies Record<string, PhaseCopy>;
}

function useUnderstandingCopy(): KindCopy<"understanding"> {
  const t = useExtracted();

  return {
    name: t("Reading your goal"),
    phases: {
      dates: {
        label: t("Checking the exam dates"),
        lines: [t("Looking up the exam calendar…"), t("Finding the dates for your year…")],
      },
      read: {
        label: t("Reading your goal"),
        lines: [
          t("Reading what you wrote…"),
          t("Working out what you want to reach…"),
          t("Checking if it's an exam, a language or a subject…"),
        ],
      },
    },
  };
}

function useCurriculumCopy(): KindCopy<"curriculum"> {
  const t = useExtracted();
  const goal = useGoalPhaseCopy();

  return {
    name: t("Building your plan"),
    phases: {
      ...goal,
      plan: {
        label: t("Fitting the plan into your days"),
        lines: [
          t("Finding lessons in the Library…"),
          t("Spreading the skills over your days…"),
          t("Saving your plan…"),
        ],
      },
    },
  };
}

function usePlacementCopy(): KindCopy<"placement"> {
  const t = useExtracted();
  const questionLines = useQuestionLines();
  const goal = useGoalPhaseCopy();

  return {
    name: t("Getting your questions ready"),
    phases: {
      ...goal,
      questions: {
        label: t("Writing your questions"),
        lines: [t("Picking the skills to ask about…")],
        numbered: questionLines({ count: 6 }),
      },
    },
  };
}

function useFirstLessonCopy(): KindCopy<"firstLesson"> {
  const t = useExtracted();
  const goal = useGoalPhaseCopy();

  return {
    name: t("Getting your first day ready"),
    phases: {
      ...goal,
      day: {
        label: t("Planning your first day"),
        lines: [t("Finding lessons in the Library…"), t("Choosing where to start…")],
      },
    },
  };
}

function useCourseOutlineCopy(): KindCopy<"courseOutline"> {
  const t = useExtracted();
  const { skills } = useGoalPhaseCopy();

  return {
    name: t("Outlining your courses"),
    phases: {
      outline: {
        label: t("Outlining your courses"),
        lines: [t("Starting with the part you'll reach first…")],
        numbered: {
          count: 6,
          line: (number) => t("Outlining chapter {number}…", { number: String(number) }),
          review: t("Checking the chapters flow…"),
        },
      },
      plan: {
        label: t("Choosing your courses"),
        lines: [t("Finding courses in the Library…"), t("Saving your plan…")],
      },
      skills,
    },
  };
}

function useLevelTestBankCopy(): KindCopy<"levelTestBank"> {
  const t = useExtracted();

  return {
    name: t("Preparing your level test"),
    phases: {
      bank: {
        label: t("Writing the level test questions"),
        lines: [
          t("Choosing texts from beginner to advanced…"),
          t("Writing the reading questions…"),
          t("Writing the listening questions…"),
          t("Checking each question has one right answer…"),
        ],
      },
    },
  };
}

function useExplanationCopy(): KindCopy<"explanation"> {
  const t = useExtracted();

  return {
    name: t("Writing your explanation"),
    phases: {
      find: {
        label: t("Checking if someone asked it before"),
        lines: [t("Looking for a matching explanation…")],
      },
      read: { label: t("Reading your question"), lines: [t("Reading your question…")] },
      write: {
        label: t("Writing about 5 short screens"),
        lines: [],
        numbered: {
          count: 5,
          line: (number) => t("Writing screen {number}…", { number: String(number) }),
          review: t("Checking the facts…"),
        },
      },
    },
  };
}

function useTestOutQuestionsCopy(): KindCopy<"testOutQuestions"> {
  const t = useExtracted();
  const questionLines = useQuestionLines();

  return {
    name: t("Writing your questions"),
    phases: {
      questions: {
        label: t("Writing questions on this chapter"),
        lines: [t("Picking the skills to ask about…")],
        numbered: questionLines({ count: 8 }),
      },
    },
  };
}

function useFocusTestQuestionsCopy(): KindCopy<"focusTestQuestions"> {
  const t = useExtracted();
  const questionLines = useQuestionLines();

  return {
    name: t("Writing your questions"),
    phases: {
      questions: {
        label: t("Writing questions on each subject"),
        lines: [t("Picking what to ask in each subject…")],
        numbered: questionLines({ count: 8 }),
      },
    },
  };
}

function useChallengeQuestionsCopy(): KindCopy<"challengeQuestions"> {
  const t = useExtracted();
  const questionLines = useQuestionLines();

  return {
    name: t("Writing your challenge"),
    phases: {
      questions: {
        label: t("Writing questions on what you studied"),
        lines: [t("Picking the skills to ask about…")],
        numbered: questionLines({ count: 10 }),
      },
    },
  };
}

function useMockQuestionsCopy(): KindCopy<"mockQuestions"> {
  const t = useExtracted();
  const questionLines = useQuestionLines();

  return {
    name: t("Writing your mock exam"),
    phases: {
      questions: {
        label: t("Writing questions like the exam's"),
        lines: [t("Picking what to ask in each subject…")],
        numbered: questionLines({ count: 12 }),
      },
    },
  };
}

function useLessonCopy(): KindCopy<"lesson"> {
  const t = useExtracted();

  return {
    name: t("Writing your lesson"),
    phases: {
      plan: {
        label: t("Planning the lesson"),
        lines: [
          t("Choosing what to cover…"),
          t({
            description: 'Zoonk at work on a lesson. "It" is the lesson\'s topic.',
            message: "Picking the best way to explain it…",
          }),
        ],
      },
      write: {
        label: t("Writing the lesson"),
        lines: [],
        numbered: {
          count: 6,
          line: (number) => t("Writing screen {number}…", { number: String(number) }),
          review: t("Checking the answers…"),
        },
      },
    },
  };
}

/** Hooks can't be skipped, so every kind's copy is built and the wait reads its own. */
export function useGenerationCopy(kind: GenerationKind): {
  name: string;
  phases: Record<string, PhaseCopy>;
} {
  const copy = {
    challengeQuestions: useChallengeQuestionsCopy(),
    conversationCall: useConversationCallCopy(),
    courseOutline: useCourseOutlineCopy(),
    curriculum: useCurriculumCopy(),
    examSpeaking: useExamSpeakingCopy(),
    explanation: useExplanationCopy(),
    firstLesson: useFirstLessonCopy(),
    focusTestQuestions: useFocusTestQuestionsCopy(),
    lesson: useLessonCopy(),
    levelTestBank: useLevelTestBankCopy(),
    mockQuestions: useMockQuestionsCopy(),
    placement: usePlacementCopy(),
    speakingMock: useSpeakingMockCopy(),
    testOutQuestions: useTestOutQuestionsCopy(),
    understanding: useUnderstandingCopy(),
  } satisfies { [Kind in GenerationKind]: KindCopy<Kind> };

  return copy[kind];
}
