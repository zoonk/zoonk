import { type CourseLevel } from "@zoonk/db";
import { type ActivityExpected } from "../library/activities/activity-expected-answer";
import { type ActivityTolerance } from "../library/activities/activity-schemas";
import { type MaterialCitation } from "../library/sources/material-question-contract";
import { type SourceCitation } from "../library/sources/source-citation";
import { type StepContentByKind } from "../library/steps/contract/step-contract";
import { type SerializedStep } from "../player/contracts/prepare-lesson-data";

export type TeachingStepKind =
  | "activity"
  | "challenge"
  | "check"
  | "explanation"
  | "hook"
  | "spokenAnswer"
  | "summary"
  | "typedAnswer"
  | "workedExample";

type LanguageExerciseKind = SerializedStep["kind"];

/** id identifies the media asset, not the step, so picture votes reach the image. */
export type PlayableStepImage = {
  alt: string;
  height: number | null;
  id: string;
  url: string;
  width: number | null;
};

/** optionId identifies an option picture; omitted means the screen's main picture. */
export type LessonPicture = { image: PlayableStepImage; optionId?: string; stepId: string };

type PlayableStepBase = { id: string; position: number; skillId: string | null };

export type LessonStepCitation =
  | (MaterialCitation & { kind: "material" })
  | (SourceCitation & { kind: "source" })
  | { kind: "notInMaterial" };

export type PlayableTeachingStepOf<TKind extends TeachingStepKind> = PlayableStepBase & {
  citation: LessonStepCitation | null;
  content: StepContentByKind[TKind];
  image: PlayableStepImage | null;
  /** Wait for getLessonPictures while a requested screen picture is still being drawn. */
  imagePending: boolean;
  /** Original screen-generation time in epoch milliseconds; reopening does not restart its wait. */
  pictureWaitStartedAt?: number;
  kind: TKind;
  /** Missing option pictures must fall back to their descriptions. */
  optionPictures?: Readonly<Record<string, PlayableStepImage>>;
};

/** Null listening means this screen has no sentence-backed fallback. */
export type PlayableSpokenAnswerStep = PlayableTeachingStepOf<"spokenAnswer"> & {
  listening: SerializedStep | null;
};

/** `minTolerance` is the template's floor for a `numeric` answer, so apps grade as core does. */
export type PlayableActivityStep = PlayableTeachingStepOf<"activity"> & {
  minTolerance: ActivityTolerance | null;
};

/** `exploreExpected` is set only when its explore's template checks just the end state: that solved end state, drawn as main draws it. */
export type PlayableExplanationStep = PlayableTeachingStepOf<"explanation"> & {
  exploreExpected?: ActivityExpected;
};

type OtherTeachingStepKind = Exclude<TeachingStepKind, "activity" | "explanation" | "spokenAnswer">;

export type PlayableTeachingStep =
  | PlayableActivityStep
  | PlayableExplanationStep
  | PlayableSpokenAnswerStep
  | { [TKind in OtherTeachingStepKind]: PlayableTeachingStepOf<TKind> }[OtherTeachingStepKind];

export type PlayableWordHints = { note: string | null; pronunciationTip: string | null };

export type PlayableLanguageStep = PlayableStepBase & {
  exercise: SerializedStep;
  kind: LanguageExerciseKind;
  /** Only on vocabulary and translation screens whose word has a note or a tip. */
  wordHints: PlayableWordHints | null;
};

export type PlayableLibraryStep = PlayableLanguageStep | PlayableTeachingStep;

export type PlayableLibraryLesson = {
  canDo: string | null;
  chapter: { id: string; title: string } | null;
  description: string;
  estimatedMinutes: number;
  id: string;
  language: string;
  level: CourseLevel;
  skills: { id: string; name: string }[];
  steps: PlayableLibraryStep[];
  summaryIdeas: string[];
  targetLanguage: string | null;
  title: string;
};
