"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import { type CourseWorkflowStepName } from "@/lib/workflow/config";
import {
  type ThinkingMessageGenerator,
  createCountingGenerator,
  cycleMessage,
} from "@/lib/workflow/use-thinking-messages";
import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  type PhaseName,
  calculateWeightedProgress,
  getPhaseOrder,
  getPhaseStatus,
} from "./generation-phases";

export function useGenerationPhases(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  targetLanguage: string | null,
  startedSteps?: CourseWorkflowStepName[],
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    addingPronunciation: t("Adding pronunciation"),
    buildingWordList: t("Preparing practice content"),
    categorizingCourse: t("Categorizing your course"),
    creatingCoverImage: t("Creating the cover image"),
    creatingImages: t("Creating images"),
    figuringOutApproach: t("Figuring out the best approach"),
    finishing: t("Almost done"),
    gettingReady: t("Getting things ready"),
    outliningChapters: t("Writing chapters"),
    planningLessons: t("Planning your first lesson"),
    preparingVisuals: t("Preparing illustrations"),
    recordingAudio: t("Recording audio"),
    savingCourseInfo: t("Saving your course"),
    settingUpActivities: t("Setting up activities"),
    writingContent: t("Writing the lesson content"),
    writingDescription: t("Writing your course description"),
  };

  const phaseOrder = getPhaseOrder({ completedSteps, currentStep, targetLanguage });

  const phases: {
    name: PhaseName;
    label: string;
    status: PhaseStatus;
    icon: (typeof PHASE_ICONS)[PhaseName];
  }[] = phaseOrder.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, targetLanguage, startedSteps),
  }));

  const progress = calculateWeightedProgress(
    completedSteps,
    currentStep,
    targetLanguage,
    startedSteps,
  );

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  const thinkingGenerators: Record<PhaseName, ThinkingMessageGenerator> = {
    addingPronunciation: (index) =>
      cycleMessage(
        [t("Looking up how each word sounds..."), t("Mapping out the pronunciation...")],
        index,
      ),
    buildingWordList: (index) =>
      cycleMessage([t("Picking the key vocabulary..."), t("Choosing words to practice...")], index),
    categorizingCourse: (index) =>
      cycleMessage([t("Figuring out the right categories..."), t("Tagging your course...")], index),
    creatingCoverImage: (index) =>
      cycleMessage(
        [
          t("Designing the cover..."),
          t("Picking the right look..."),
          t("Adding finishing touches..."),
        ],
        index,
      ),
    creatingImages: (index) =>
      cycleMessage(
        [
          t("Drawing an illustration..."),
          t("Working on the visuals..."),
          t("Adding some color..."),
          t("Refining the details..."),
        ],
        index,
      ),
    figuringOutApproach: (index) =>
      cycleMessage(
        [t("Thinking about how to teach this..."), t("Choosing the right approach...")],
        index,
      ),
    finishing: (index) => cycleMessage([t("Wrapping up..."), t("Almost there...")], index),
    gettingReady: (index) =>
      cycleMessage([t("Setting things up..."), t("Getting everything ready...")], index),
    outliningChapters: createCountingGenerator({
      intro: [t("Planning the course structure...")],
      itemTemplate: (num) => t("Writing chapter {number}...", { number: String(num) }),
      reviewMessage: t("Reviewing the overall flow..."),
    }),
    planningLessons: createCountingGenerator({
      intro: [t("Exploring your topic..."), t("Mapping out the learning path...")],
      itemTemplate: (num) => t("Writing lesson {number}...", { number: String(num) }),
      reviewMessage: t("Reviewing the flow so far..."),
    }),
    preparingVisuals: (index) =>
      cycleMessage(
        [
          t("Thinking about what to illustrate..."),
          t("Sketching out ideas..."),
          t("Choosing the right style..."),
          t("Planning the layout..."),
        ],
        index,
      ),
    recordingAudio: (index) =>
      cycleMessage([t("Recording the audio..."), t("Getting the pronunciation right...")], index),
    savingCourseInfo: (index) =>
      cycleMessage([t("Saving your progress..."), t("Putting it all together...")], index),
    settingUpActivities: (index) =>
      cycleMessage([t("Designing practice exercises..."), t("Making it interactive...")], index),
    writingContent: (index) =>
      cycleMessage(
        [t("Researching the topic..."), t("Writing the explanation..."), t("Adding examples...")],
        index,
      ),
    writingDescription: (index) =>
      cycleMessage([t("Summarizing what you'll learn..."), t("Writing the overview...")], index),
  };

  return { activePhaseNames, phases, progress, thinkingGenerators };
}
