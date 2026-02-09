import { type ActivityKind } from "@zoonk/db";
import { type PhaseName } from "./activity-generation-phase-config";

export function getPhaseWeights(kind: ActivityKind): Record<PhaseName, number> {
  if (kind === "vocabulary") {
    return {
      addingPronunciation: 25,
      buildingWordList: 20,
      creatingImages: 0,
      finishing: 10,
      gettingStarted: 3,
      preparingVisuals: 0,
      processingDependencies: 0,
      recordingAudio: 42,
      writingContent: 0,
    };
  }

  if (kind === "background" || kind === "custom") {
    return {
      addingPronunciation: 0,
      buildingWordList: 0,
      creatingImages: 43,
      finishing: 7,
      gettingStarted: 3,
      preparingVisuals: 22,
      processingDependencies: 0,
      recordingAudio: 0,
      writingContent: 25,
    };
  }

  if (kind === "grammar") {
    return {
      addingPronunciation: 0,
      buildingWordList: 0,
      creatingImages: 0,
      finishing: 10,
      gettingStarted: 5,
      preparingVisuals: 0,
      processingDependencies: 0,
      recordingAudio: 0,
      writingContent: 85,
    };
  }

  if (kind === "reading") {
    return {
      addingPronunciation: 0,
      buildingWordList: 35,
      creatingImages: 0,
      finishing: 10,
      gettingStarted: 3,
      preparingVisuals: 0,
      processingDependencies: 0,
      recordingAudio: 52,
      writingContent: 0,
    };
  }

  if (kind === "story" || kind === "challenge" || kind === "review") {
    return {
      addingPronunciation: 0,
      buildingWordList: 0,
      creatingImages: 0,
      finishing: 10,
      gettingStarted: 5,
      preparingVisuals: 0,
      processingDependencies: 40,
      recordingAudio: 0,
      writingContent: 45,
    };
  }

  return {
    addingPronunciation: 0,
    buildingWordList: 0,
    creatingImages: 35,
    finishing: 9,
    gettingStarted: 3,
    preparingVisuals: 18,
    processingDependencies: 15,
    recordingAudio: 0,
    writingContent: 20,
  };
}
