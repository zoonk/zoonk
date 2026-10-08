import { type CourseCategory } from "@zoonk/utils/categories";
import {
  type CourseFormat,
  type CourseLevel,
  type ItemFormat,
  type StepKind,
} from "../../../../generated/prisma/client";
import { type Localized, type LocalizedObject, type SeedLanguage } from "../_utils/localize";

/** One thing a learner can do: the unit of mastery, review and study cards. */
export type SeedSkill = {
  key: string;
  name: Localized;
  /** The idea in one sentence: the front of the study card. */
  description: Localized;
  /** A concrete example: the back of the study card. */
  example?: Localized;
  /** Where it shows up in real life, for the lesson spec of a written lesson. */
  useCase?: Localized;
  hard?: boolean;
  level: CourseLevel | null;
  /** Keys of skills learned first, in the same course. */
  prerequisites?: readonly string[];
};

/** A bank question for one skill, stored in `Item.content` for its format. */
export type SeedItem = {
  key: string;
  skill: string;
  format: ItemFormat;
  /** Starting difficulty on the IRT-style scale: -1 easy, 0 medium, 1 hard. */
  difficulty: number;
  /** Items written in an exam's format point at its blueprint. */
  exam?: string;
  content: LocalizedObject;
};

/** One lesson screen, in the v2 step contract for its kind. */
export type SeedStep = {
  kind: StepKind;
  content: LocalizedObject;
  /** Key of the lesson skill the screen teaches; the lesson's first skill when absent. */
  skill?: string;
  /** Target-language word or sentence for vocabulary, reading, listening and translation screens. */
  word?: string;
  sentence?: string;
  /** How the lesson spec names the screen, when it isn't the step kind ("application"). */
  screen?: "application";
};

/** A word a language lesson teaches, with its meaning for this language pair. */
type SeedLessonWord = {
  word: string;
  translation: Localized;
  /** Target-language words a learner could confuse with this one, shown as wrong options. */
  distractors: string[];
  /** A false friend or usage trap, in the learner's language. */
  note?: Localized;
};

/** A sentence a language lesson reads or plays, with its meaning and why it's built this way. */
type SeedLessonSentence = {
  sentence: string;
  translation: Localized;
  explanation: Localized;
  /** Target-language words for the sentence's word bank that don't belong in it. */
  distractors: string[];
  /** Learner-language words for the translation's word bank that don't belong in it. */
  translationDistractors: Localized[];
};

/**
 * A lesson in a chapter's outline. Outline lessons have a title, a description and their skills;
 * written lessons also have their steps, and their summary card comes from the `summary` step.
 */
export type SeedLesson = {
  key: string;
  title: Localized;
  description: Localized;
  canDo?: Localized;
  minutes: number;
  skills: readonly string[];
  supportMode?: "explanationFirst" | "questionFirst";
  steps?: readonly SeedStep[];
  /** Language lessons: the pair's translations of the shared words and sentences they use. */
  words?: readonly SeedLessonWord[];
  sentences?: readonly SeedLessonSentence[];
};

export type SeedChapter = {
  key: string;
  title: Localized;
  description: Localized;
  objectives: readonly Localized[];
  level: CourseLevel;
  /** The exam area the chapter belongs to ("Math"), which plans group skills by. */
  area?: Localized;
  /** How much the chapter's topics pay off on the exam, from 1 to 5, from how often they're asked. */
  weight?: number;
  /**
   * The chapter is one of the exam's written tests (a redação): plan graphs mark its skills as
   * outcome skills, as the skill graph does for an exam's parts answered in writing.
   */
  writtenTest?: boolean;
  /** What the lessons have the learner use on their own device, for the plan's "You'll use" card. */
  tools?: readonly { essential: boolean; name: Localized }[];
  lessons: readonly SeedLesson[];
};

/** A target-language word or sentence the lessons reuse, shared by every course that teaches it. */
type SeedVocabulary = {
  text: string;
  /** How a learner-language speaker says it, stored as the word's pronunciation guide. */
  pronunciation?: Localized;
  /** Where speakers of the learner's language tend to get stuck saying it. */
  tip?: Localized;
};

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
  /** Chapters in outline order; each sits in its level band. */
  chapters: readonly SeedChapter[];
  /** Quick explanations whose "Want to go further?" leads into this course. They sit in no chapter. */
  explanations?: readonly SeedLesson[];
  skills: readonly SeedSkill[];
  items: readonly SeedItem[];
  words?: readonly SeedVocabulary[];
  sentences?: readonly SeedVocabulary[];
};
