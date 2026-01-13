import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  CheckIcon,
  ImageIcon,
  LayoutListIcon,
  ListPlusIcon,
  PenIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  TagsIcon,
  TextIcon,
} from "lucide-react";
import type { StepName } from "@/workflows/course-generation/types";

export const STEP_ICONS: Record<StepName, LucideIcon> = {
  addAlternativeTitles: ListPlusIcon,
  addCategories: ListPlusIcon,
  addChapters: ListPlusIcon,
  addLessons: ListPlusIcon,
  checkExistingCourse: SearchIcon,
  finalize: CheckIcon,
  generateAlternativeTitles: SparklesIcon,
  generateCategories: TagsIcon,
  generateChapters: LayoutListIcon,
  generateDescription: TextIcon,
  generateImage: ImageIcon,
  generateLessons: PenIcon,
  getCourseSuggestion: BookOpenIcon,
  initializeCourse: SettingsIcon,
  updateCourse: CheckIcon,
};
