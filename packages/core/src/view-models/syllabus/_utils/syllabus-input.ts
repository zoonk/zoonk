import { type TopicFrequencyLevel } from "../../../library/exams/blueprint-contract";
import { type PassMarks } from "../../../library/exams/pass-marks";
import { type TopicFrequencySource } from "../../../library/exams/topic-frequency";
import { type TodayLearnBlock } from "../../../plans/_utils/up-next-item";
import { type ExistingPlanItem } from "../../../plans/planner/plan-items";
import { type WrittenPractice } from "../../../plans/written-practice-contract";
import { type SyllabusView } from "../syllabus-contract";

/** A subject as the exam's notice lists it, with its share of the exam worked out. */
export type NoticeSubject = {
  /** Where how often the exam asks its topics comes from, when a lookup found it. */
  frequencySource?: TopicFrequencySource | null;
  group: string | null;
  /** A skills matrix's statements, when the topics are its contents (see `matrix` on the blueprint). */
  matrix?: readonly string[];
  name: string;
  /**
   * The subject the notice counts it in, for an option of a choice the learner picked (ENEM's
   * foreign language, inside its languages area): it's shown as part of that subject.
   */
  partOf?: string | null;
  questions: number | null;
  share: number | null;
  /** The notice's own short label ("Constitutional Law"), when its name is long. */
  shortName: string | null;
  /** How often past exams asked each of its topics, by the topic's words, where something says. */
  topicFrequency?: ReadonlyMap<string, TopicFrequencyLevel>;
  /** The notice's heading each of its topics sits under, by the topic's words (ENEM's "Physics"). */
  topicHeadings?: ReadonlyMap<string, string>;
  topics: readonly string[];
  /**
   * What the subject's written test asks, as the notice says it ("legal brief on
   * specific knowledge"): a plan's area for one of them is part of the subject.
   */
  writtenTasks: readonly string[];
};

/** A skill of the plan's graph, with its area as the planner reads it and the topics it teaches. */
export type SyllabusSkill = {
  area: string;
  /** The graph's size for it: what a plan item standing in for its unwritten lessons stands for. */
  lessons?: number;
  name: string;
  skillId: string;
  topics: readonly string[];
};

/** A lesson of the plan, its skill known even when the item didn't store it. */
export type SyllabusItem = Pick<
  ExistingPlanItem,
  | "chapterId"
  | "id"
  | "kind"
  | "lessonId"
  | "lessons"
  | "phase"
  | "scheduledFor"
  | "skillId"
  | "status"
  | "titleSnapshot"
>;

/** The Library course an area is taught in: its title and icon. */
export type AreaCourse = { imageUrl: string | null; title: string };

/** Everything a syllabus is built from. */
export type SyllabusInput = {
  areaCourses: ReadonlyMap<string, AreaCourse>;
  chapterTitles: ReadonlyMap<string, string>;
  /** The plan's lessons in plan order. */
  items: readonly SyllabusItem[];
  notice: {
    /** How the learner's course weighs the exam's parts (see `readCourseWeights`). */
    courseWeights: SyllabusView["courseWeights"];
    /** Read from the learner's own material (a class test's slides or notes), not a notice. */
    fromMaterial: boolean;
    passMarks: PassMarks | null;
    questionsSource: SyllabusView["questionsSource"];
    subjects: readonly NoticeSubject[];
    url: string | null;
  } | null;
  /**
   * Skills the learner showed they know (a right test answer or a test-out, not missed since; see
   * `SkillClaim`): one with no lessons in the plan is still in it, as practice.
   */
  knownSkillIds: ReadonlySet<string>;
  /**
   * How far ahead the plan writes lessons (`getOutlinedUntil`): a topic starting after it names
   * its skill, to ask for its lessons early. Without it, none does.
   */
  outlinedUntil?: string | null;
  /**
   * Skills the plan starts past: a subject's basics the learner said they know, or does well in
   * with harder lessons (see `getPastBasicsSkillIds`).
   */
  pastBasicsSkillIds: ReadonlySet<string>;
  skills: readonly SyllabusSkill[];
  skippedAreas: readonly string[];
  /** Bases the learner chose to skip (see `PlanSettings.baseChoices`). */
  skippedBaseIds?: ReadonlySet<string>;
  /** Stand-in skills chapters already teach (`listTaughtStandInSkills`): none to ask for early. */
  taughtSkillIds?: ReadonlySet<string>;
  /**
   * Today's lessons not done yet, as Today opens them (`loadTodayLearnBlocks`), which the page
   * reads apart: the chapter up next is the one Today opens (`findUpNextItem`). Without them, it's
   * the plan's next lesson.
   */
  todayBlocks?: readonly TodayLearnBlock[];
  /** When the exam's written tests are practiced (see `getWrittenPracticeView`). */
  writtenPractice?: WrittenPractice | null;
};
