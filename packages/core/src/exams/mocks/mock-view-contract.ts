import { type NumericEntry, type OptionSelect } from "@zoonk/ai/tasks/v2/items/schemas";
import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type SectionNavigation } from "../../library/exams/blueprint-contract";
import { type ItemImage } from "../../library/items/item-image";
import { type ItemSetView } from "../../library/items/item-set-view";
import { type ItemCitation } from "../../library/sources/source-citation";
import { type EssayGradeView } from "../essays/essay-contract";
import { type MockAnswer } from "./mock-answer-contract";

type MockQuestionFormat = "multipleChoice" | "numeric" | "trueFalse" | "typed";

export type MockQuestion = {
  area: string | null;
  context: string | null;
  entry: NumericEntry | null;
  format: MockQuestionFormat | "essay";
  image: ItemImage | null;
  itemId: string;
  number: number;
  options: string[] | null;
  question: string;
  select: OptionSelect | null;
  set: ItemSetView | null;
  skillId: string;
  unit: { position: "prefix" | "suffix"; symbol: string } | null;
  visual: LessonVisual | null;
};

export type MockDraft = {
  answer: MockAnswer | null;
  durationMs: number;
  flagged: boolean;
  itemId: string;
};

export type MockCurrentSection = {
  changesLeft: number | null;
  deadline: string;
  drafts: MockDraft[];
  kind: "listening" | "speaking" | null;
  plays: { played: number; setId: string }[];
  questions: MockQuestion[];
  resume: number;
  section: number;
};

export type MockSectionView = {
  breakAfterMinutes: number | null;
  essays: number;
  index: number;
  minutes: number;
  name: string | null;
  navigation: SectionNavigation | null;
  questions: number;
  status: "current" | "done" | "upcoming";
  tools: string | null;
};

export type MockReviewEntry = {
  area: string | null;
  citation: ItemCitation | null;
  context: string | null;
  set: ItemSetView | null;
  correctAnswer: string | null;
  explanation: string | null;
  format: MockQuestionFormat;
  itemId: string;
  learnerAnswer: string | null;
  number: number;
  outcome: "blank" | "partial" | "wrong";
  question: string;
};

export type MockEssayView = {
  area: string | null;
  context: string | null;
  grade: EssayGradeView | null;
  itemId: string;
  question: string;
  status: "blank" | "graded" | "pending";
  text: string | null;
};

export type MockSizeSource = {
  formats: "even" | "notice" | null;
  material: boolean;
  pastEdition: { edition: string | null; title: string | null; url: string } | null;
  questions: "notice" | "pastEdition" | "unstated";
  subjects: "even" | "notice" | "pastEdition" | null;
  time: "notice" | "unstated";
};

export type MockAdaptView = {
  focus: { area: string; correct: number; total: number } | null;
  skip: { lessons: number; topics: string[] } | null;
};

export type MockLeftOut = {
  name: string | null;
  part:
    | "listening"
    | "numeric"
    | "practical"
    | "shortAnswer"
    | "speaking"
    | "written"
    | "writtenInFull";
};

export type MockScoreNotes = {
  noticeScoring: string | null;
  relative: boolean;
  scale: {
    max: number;
    min: number;
    name: string | null;
    passScore: number | null;
    score: number | null;
  } | null;
};
