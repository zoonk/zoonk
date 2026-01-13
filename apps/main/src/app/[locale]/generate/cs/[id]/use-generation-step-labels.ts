"use client";

import { useExtracted } from "next-intl";
import type { StepName } from "@/workflows/course-generation/types";

type StepLabels = Record<StepName, string>;

export function useGenerationStepLabels() {
  const t = useExtracted();

  const labels: StepLabels = {
    addAlternativeTitles: t("Adding alternative titles"),
    addCategories: t("Adding categories"),
    addChapters: t("Adding chapters"),
    addLessons: t("Adding lessons"),
    checkExistingCourse: t("Checking for existing course"),
    completeCourseSetup: t("Completing course setup"),
    generateAlternativeTitles: t("Generating alternative titles"),
    generateCategories: t("Identifying categories"),
    generateChapters: t("Planning chapters"),
    generateDescription: t("Generating description"),
    generateImage: t("Creating course image"),
    generateLessons: t("Generating lessons"),
    getCourseSuggestion: t("Loading course information"),
    initializeCourse: t("Setting up course"),
    updateCourse: t("Saving course details"),
  };

  function getLabel(step: StepName): string {
    return labels[step];
  }

  return { getLabel, labels };
}
