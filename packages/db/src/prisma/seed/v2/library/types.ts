import { type CourseCategory } from "@zoonk/utils/categories";
import {
  type CourseFormat,
  type CourseLevel,
  type ItemFormat,
  type StepKind,
} from "../../../../generated/prisma/client";
import { type Localized, type LocalizedObject, type SeedLanguage } from "../_utils/localize";

export type SeedSkill = {
  key: string;
  name: Localized;
  description: Localized;
  example?: Localized;
  useCase?: Localized;
  hard?: boolean;
  level: CourseLevel | null;
  prerequisites?: readonly string[];
};

export type SeedItem = {
  key: string;
  skill: string;
  format: ItemFormat;
  /** Starting difficulty on the IRT-style scale: -1 easy, 0 medium, 1 hard. */
  difficulty: number;
  exam?: string;
  content: LocalizedObject;
};

export type SeedStep = {
  kind: StepKind;
  content: LocalizedObject;
  /** The lesson's first skill when absent. */
  skill?: string;
  word?: string;
  sentence?: string;
  screen?: "application";
};

type SeedLessonWord = {
  word: string;
  translation: Localized;
  distractors: string[];
  note?: Localized;
};

type SeedLessonSentence = {
  sentence: string;
  translation: Localized;
  explanation: Localized;
  distractors: string[];
  translationDistractors: Localized[];
};

export type SeedLesson = {
  key: string;
  title: Localized;
  description: Localized;
  canDo?: Localized;
  minutes: number;
  skills: readonly string[];
  supportMode?: "explanationFirst" | "questionFirst";
  steps?: readonly SeedStep[];
  words?: readonly SeedLessonWord[];
  sentences?: readonly SeedLessonSentence[];
};

export type SeedChapter = {
  key: string;
  title: Localized;
  description: Localized;
  objectives: readonly Localized[];
  level: CourseLevel;
  area?: Localized;
  /** 1 to 5, from how often the exam asks the chapter's topics. */
  weight?: number;
  writtenTest?: boolean;
  tools?: readonly { essential: boolean; name: Localized }[];
  lessons: readonly SeedLesson[];
};

type SeedVocabulary = { text: string; pronunciation?: Localized; tip?: Localized };

export type SeedCourse = {
  key: string;
  /** Course slugs are unique per organization, so each language has its own. */
  slug: Localized;
  title: Localized;
  description: Localized;
  format: CourseFormat;
  category: CourseCategory;
  languages: readonly SeedLanguage[];
  targetLanguage?: string;
  chapters: readonly SeedChapter[];
  explanations?: readonly SeedLesson[];
  skills: readonly SeedSkill[];
  items: readonly SeedItem[];
  words?: readonly SeedVocabulary[];
  sentences?: readonly SeedVocabulary[];
};
