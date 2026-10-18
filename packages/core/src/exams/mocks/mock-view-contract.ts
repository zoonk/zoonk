import { type NumericEntry, type OptionSelect } from "@zoonk/ai/tasks/v2/items/schemas";
import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type SectionNavigation } from "../../library/exams/blueprint-contract";
import { type ItemImage } from "../../library/items/item-image";
import { type ItemSetView } from "../../library/items/item-set-view";
import { type ItemCitation } from "../../library/sources/source-citation";
import { type EssayGradeView } from "../essays/essay-contract";
import { type MockAnswer } from "./mock-answer-contract";

/** The formats a mock asks in, the exam's own: picks, a typed number or a typed word. */
type MockQuestionFormat = "multipleChoice" | "numeric" | "trueFalse" | "typed";

/**
 * A question as the learner sees it during the mock: never the answer or why. An essay (a full
 * mock's written part) is answered with its text, on its section's clock.
 */
export type MockQuestion = {
  area: string | null;
  context: string | null;
  /** A numeric question's answer box: any number, a whole one, n decimals or a fraction. */
  entry: NumericEntry | null;
  format: MockQuestionFormat | "essay";
  /** The figure the question is about, when it's about one. */
  image: ItemImage | null;
  itemId: string;
  /** Its number across the whole mock, as the answer sheet counts. */
  number: number;
  options: string[] | null;
  question: string;
  /** How many options a multiple-choice question asks to pick: one, an exact number or "all". */
  select: OptionSelect | null;
  /** The text, case or chart it shares with its set's other questions, shown with each of them. */
  set: ItemSetView | null;
  skillId: string;
  /** The unit beside a numeric question's answer box, where its language writes it. */
  unit: { position: "prefix" | "suffix"; symbol: string } | null;
  /** A chart or timeline the question reads, drawn from its data. */
  visual: LessonVisual | null;
};

export type MockDraft = {
  answer: MockAnswer | null;
  durationMs: number;
  flagged: boolean;
  itemId: string;
};

/** The running section: its questions (never with answers), the learner's drafts and its clock. */
export type MockCurrentSection = {
  /** The answers the end review of a forward-only section may still change; null: no limit. */
  changesLeft: number | null;
  deadline: string;
  drafts: MockDraft[];
  /**
   * `listening`: its questions are on recordings; `speaking`: the speaking paper, its tasks live
   * calls (see `MockView.speaking`); null for the others.
   */
  kind: "listening" | "speaking" | null;
  /**
   * A listening section's recordings, each with the plays the mock already counted (see
   * `recordMockPlay`), so another tab or device can't play one again; empty for other sections.
   */
  plays: { played: number; setId: string }[];
  questions: MockQuestion[];
  /** The question it opens at: the furthest one reached in a forward-only section, else 0. */
  resume: number;
  section: number;
};

export type MockSectionView = {
  /** The break after it, before the next section's clock starts, in minutes. */
  breakAfterMinutes: number | null;
  /** The essays it asks: a full mock's written part, beside its questions or on its own. */
  essays: number;
  index: number;
  minutes: number;
  name: string | null;
  /** How it's moved through, as the notice says (see `SectionNavigation`); null moves freely. */
  navigation: SectionNavigation | null;
  questions: number;
  status: "current" | "done" | "upcoming";
  /** What may be used or is given in it, in the notice's words. */
  tools: string | null;
};

/** A question missed, partly right or left blank, with the right answer and why, after the mock. */
export type MockReviewEntry = {
  area: string | null;
  /**
   * The passage it quotes, such as an article of law, with its source's title, link and the date
   * it was last checked.
   */
  citation: ItemCitation | null;
  /** The text the question reads before it (the equation, the case), as the mock showed it. */
  context: string | null;
  /** The text, case or chart it shares with its set's other questions. */
  set: ItemSetView | null;
  /** For true or false questions, the answers are "true" or "false", shown in the app's words. */
  correctAnswer: string | null;
  explanation: string | null;
  format: MockQuestionFormat;
  itemId: string;
  learnerAnswer: string | null;
  number: number;
  /** `partial`: a question with several picks that earned part of its points. */
  outcome: "blank" | "partial" | "wrong";
  question: string;
};

/**
 * A full mock's essay once the mock is over: what was asked, the learner's text, and its grade by
 * the exam's official rubric. `pending`: written and not graded yet (grading is a model call made
 * right after hand-in, POST its grading); `blank`: left blank, so nothing to grade.
 */
export type MockEssayView = {
  area: string | null;
  context: string | null;
  grade: EssayGradeView | null;
  itemId: string;
  question: string;
  status: "blank" | "graded" | "pending";
  text: string | null;
};

/**
 * Where a mock's size comes from, said on the mock whenever it isn't the notice: the exam's number
 * of questions (its notice's, a past edition's, or stated nowhere, so the mock's own length), how
 * they split by subject (the notice's, a past edition's, evenly because nothing counts them, or
 * null for an exam of one subject), and its time (the notice's, or a usual pace). `pastEdition`
 * cites the edition counts follow; `material` marks a class test read from the learner's own
 * material, which has no notice.
 */
export type MockSizeSource = {
  /**
   * How the questions split by format: the notice's counts, evenly because it counts none, or
   * null for an exam of one format (see `getFormatMixSource`).
   */
  formats: "even" | "notice" | null;
  material: boolean;
  pastEdition: { edition: string | null; title: string | null; url: string } | null;
  questions: "notice" | "pastEdition" | "unstated";
  subjects: "even" | "notice" | "pastEdition" | null;
  time: "notice" | "unstated";
};

/**
 * What a finished mock offers to change in the plan, each answered by the learner, never applied
 * on its own: skip the lessons of the topics it showed they know (every question on them right),
 * and give the area that went worst more of the plan's time. Null parts have nothing to offer.
 */
export type MockAdaptView = {
  focus: { area: string; correct: number; total: number } | null;
  skip: { lessons: number; topics: string[] } | null;
};

/**
 * A part of the real exam a mock leaves out, said on the mock with why: a listening, speaking or
 * practical section it can't run yet (`name`, the notice's), a written part with no essay in the
 * bank yet, practiced in essay sessions instead, a written part only full mocks ask
 * (`writtenInFull`: half of a day leaves it out), or questions the exam answers with a number or
 * a few words, which mocks ask as multiple choice (`name` null: the whole exam's).
 */
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

/**
 * What a mock's result says about the real score (see `getScoreNotes`): the notice's own sentence
 * on how the exam scores it, where the mock only counts right answers, and whether the real result
 * depends on everyone in the sitting.
 */
export type MockScoreNotes = {
  noticeScoring: string | null;
  relative: boolean;
  /**
   * The exam's own score scale (the notice's, or a preset like the SAT's), with this mock's right
   * answers on it (`score`) once it's over, where the map from a share of right answers is known;
   * null for an exam without one, or one scored with item response theory.
   */
  scale: {
    max: number;
    min: number;
    name: string | null;
    passScore: number | null;
    score: number | null;
  } | null;
};
