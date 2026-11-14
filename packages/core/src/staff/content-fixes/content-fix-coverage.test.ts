import { ItemFormat, StepKind } from "@zoonk/db/enums";
import { databaseSchema } from "@zoonk/db/schema";
import { describe, expect, it } from "vitest";
import { isRelationKind } from "../../library/steps/contract/step-contract";
import { FIXABLE_MODELS, FIX_HANDLERS } from "./handlers/registry";

const PROPOSABLE = new Set(
  FIX_HANDLERS.flatMap((handler) => (handler.proposal ? [`${handler.model} ${handler.op}`] : [])),
);

/** Rows another model's operation rewrites as one collection. */
const FIXED_THROUGH: Record<string, string> = {
  ChapterLesson: "Chapter setLessons",
  ChapterSkill: "Chapter setSkills",
  CourseCategory: "Course setCategories",
  CourseChapter: "Course setChapters",
  LessonSkill: "Lesson setSkills",
  SkillPrerequisite: "Skill setPrerequisites",
  StepOptionPicture: "Step setOptions",
};

const ONE_LEARNERS = "One learner's own data or a snapshot of it, never shared content.";
const SIGN_IN = "Sign-in, account or billing data.";
const BOOKKEEPING = "Generation, grading or operations bookkeeping learners never read.";

/**
 * What no content fix changes, each with why. `Model: part` names a refused part of a model that
 * is otherwise fixable.
 */
const NOT_FIXED: Record<string, string> = {
  AccessRecord: SIGN_IN,
  Account: SIGN_IN,
  AccountDeletion: SIGN_IN,
  AiCall: BOOKKEEPING,
  AnonymousExamResult: ONE_LEARNERS,
  AnonymousFirstAnswer: ONE_LEARNERS,
  AnonymousLessonPace: ONE_LEARNERS,
  AnonymousLevelTest: ONE_LEARNERS,
  AnonymousMockAnswer: ONE_LEARNERS,
  Attempt: ONE_LEARNERS,
  Certificate: ONE_LEARNERS,
  "Chapter: creating, deleting or merging": "Structure fixes rearrange existing rows only.",
  ContentFix: "The fixes themselves; revert proposes an inverse fix.",
  ContentReviewFlag: BOOKKEEPING,
  "Course: creating, deleting or merging": "Structure fixes rearrange existing rows only.",
  CourseFamily: "Holds only an id grouping a course's editions in other languages.",
  DailyProgress: ONE_LEARNERS,
  DeviceCode: SIGN_IN,
  EssayGradeClaim: ONE_LEARNERS,
  EvaluationRun: BOOKKEEPING,
  ExamResult: ONE_LEARNERS,
  Feedback: ONE_LEARNERS,
  FollowUp: BOOKKEEPING,
  Goal: ONE_LEARNERS,
  GoalUnderstanding: ONE_LEARNERS,
  GuestSpendDay: SIGN_IN,
  InstrumentWaitlistEntry: ONE_LEARNERS,
  Invitation: SIGN_IN,
  "Item: a private skill's question": "Private content is one learner's.",
  LanguageConversation: ONE_LEARNERS,
  LanguageSkillLevel: ONE_LEARNERS,
  LawLookup: "A cached search result; the Source it found is fixable.",
  LearnerCondition: ONE_LEARNERS,
  LearnerSkill: ONE_LEARNERS,
  LearnerSource: ONE_LEARNERS,
  LearnerWord: ONE_LEARNERS,
  LearningEvent: ONE_LEARNERS,
  "Lesson: creating, deleting or merging": "Structure fixes rearrange existing rows only.",
  LessonIcon: "Pixels lesson marks point at; marks are derived and a fix can't redraw.",
  LessonQuestion: ONE_LEARNERS,
  LessonQuestionThread: ONE_LEARNERS,
  LiveCallConnection: BOOKKEEPING,
  "MediaAsset: pixels": "A fix stores no image; a wrong screen picture is detached.",
  Member: SIGN_IN,
  MemoryFact: ONE_LEARNERS,
  MemoryInsight: ONE_LEARNERS,
  Milestone: ONE_LEARNERS,
  Mistake: ONE_LEARNERS,
  MistakePattern: ONE_LEARNERS,
  MockExam: ONE_LEARNERS,
  MockExamAnswer: ONE_LEARNERS,
  ModelGrade: BOOKKEEPING,
  OauthAccessToken: SIGN_IN,
  OauthClient: SIGN_IN,
  OauthClientAssertion: SIGN_IN,
  OauthClientResource: SIGN_IN,
  OauthConsent: SIGN_IN,
  OauthRefreshToken: SIGN_IN,
  OauthResource: SIGN_IN,
  OnboardingDraft: ONE_LEARNERS,
  "Organization: an account's organization":
    "Better Auth owns organizations research didn't write.",
  Passkey: SIGN_IN,
  Plan: ONE_LEARNERS,
  PlanChange: ONE_LEARNERS,
  PlanChangeSnapshot: ONE_LEARNERS,
  PlanItem: ONE_LEARNERS,
  ProfileAnswer: ONE_LEARNERS,
  PronunciationReview: ONE_LEARNERS,
  RateLimit: SIGN_IN,
  RestoreKey: SIGN_IN,
  SavedMindMap: ONE_LEARNERS,
  Session: SIGN_IN,
  "Skill: creating, deleting or merging": "Structure fixes rearrange existing rows only.",
  SourceUpload: ONE_LEARNERS,
  "Step: a new picture option": "Every picture option needs a generated picture.",
  "Step: a new screen picture": "A fix stores no image; it can only detach a wrong one.",
  "Step: kind, ids or entry counts outside options": "Learners mid-lesson are graded by them.",
  StepExampleLine: ONE_LEARNERS,
  StepVariantGeneration: BOOKKEEPING,
  StudyReminder: ONE_LEARNERS,
  StudySession: ONE_LEARNERS,
  StudySessionBlock: ONE_LEARNERS,
  Subscription: SIGN_IN,
  SuggestedGoal: ONE_LEARNERS,
  TestSubmissionClaim: ONE_LEARNERS,
  UsageRecord: SIGN_IN,
  User: SIGN_IN,
  UserLearningProfile: ONE_LEARNERS,
  UserProgress: ONE_LEARNERS,
  Verification: SIGN_IN,
  "Word: text other lessons' tiles find it by, beyond its case":
    "Tiles look the row up by their text.",
};

/** Shared rows learners see that no fix reaches yet. */
const NO_FIX_PATH_YET: Record<string, string> = {};

const ITEM_SET = "ItemSet replace";
const STEP_SET = "Step set";
const WORD_PATHS = ["Word set", "LessonWord set", "Word revoice"];
const SENTENCE_PATHS = ["Sentence set", "LessonSentence set", "Sentence revoice"];

const SCREEN_PATHS: Record<StepKind, readonly string[]> = {
  activity: [STEP_SET, "Step setOptions"],
  alphabet: [STEP_SET],
  challenge: [STEP_SET, "Step setOptions"],
  check: [STEP_SET, "Step setOptions", "Item set"],
  explanation: [STEP_SET],
  fillBlank: [STEP_SET],
  hook: [STEP_SET, "Step setOptions"],
  listening: SENTENCE_PATHS,
  matchColumns: [STEP_SET],
  multipleChoice: [STEP_SET, "Step setOptions"],
  reading: SENTENCE_PATHS,
  spokenAnswer: [STEP_SET, "Sentence set"],
  summary: [STEP_SET],
  translation: WORD_PATHS,
  typedAnswer: [STEP_SET],
  vocabulary: WORD_PATHS,
  workedExample: [STEP_SET],
};

const QUESTION_PATHS: Record<ItemFormat, readonly string[]> = {
  essay: ["Item replace", ITEM_SET],
  matchPairs: ["Item replace", ITEM_SET],
  multipleChoice: ["Item set", "Item replace", ITEM_SET],
  numeric: ["Item set", "Item replace", ITEM_SET],
  order: ["Item replace", ITEM_SET],
  spoken: ["Item replace", ITEM_SET],
  trueFalse: ["Item set", "Item replace", ITEM_SET],
  typed: ["Item replace", ITEM_SET],
};

describe("content fix coverage", () => {
  const fixable = [...FIXABLE_MODELS.keys()];
  const excludedParts = Object.keys(NOT_FIXED).filter((key) => key.includes(":"));

  it("gives every Prisma model one fix path, written exclusion or known gap", () => {
    const declared = [
      ...fixable,
      ...Object.keys(FIXED_THROUGH),
      ...Object.keys(NOT_FIXED).filter((key) => !key.includes(":")),
      ...Object.keys(NO_FIX_PATH_YET),
    ];

    const models = databaseSchema.models.map((model) => model.name);

    expect({
      duplicated: declared.filter((name, index) => declared.indexOf(name) !== index),
      missing: models.filter((model) => !declared.includes(model)),
      stale: declared.filter((name) => !models.includes(name)),
    }).toStrictEqual({ duplicated: [], missing: [], stale: [] });
  });

  it("routes every screen kind and question format to operations the registry proposes", () => {
    const paths = [
      ...Object.values(StepKind).flatMap((kind) => SCREEN_PATHS[kind]),
      ...Object.values(ItemFormat).flatMap((format) => QUESTION_PATHS[format]),
      ...Object.values(FIXED_THROUGH),
    ];

    expect({
      paths: paths.filter((path) => !PROPOSABLE.has(path)),
      refusedParts: excludedParts.filter((key) => !fixable.includes(key.split(":")[0] ?? "")),
    }).toStrictEqual({ paths: [], refusedParts: [] });
  });

  it("fixes a screen that holds no text through its word or sentence", () => {
    expect(
      Object.values(StepKind).filter(
        (kind) => SCREEN_PATHS[kind].includes(STEP_SET) === isRelationKind(kind),
      ),
    ).toStrictEqual([]);
  });
});
