import { type TopicFrequencyLevel } from "../../../library/exams/blueprint-contract";
import { type PassMarks } from "../../../library/exams/pass-marks";
import { type TopicFrequencySource } from "../../../library/exams/topic-frequency";
import { type TodayLearnBlock } from "../../../plans/_utils/up-next-item";
import { type ExistingPlanItem } from "../../../plans/planner/plan-items";
import { type WrittenPractice } from "../../../plans/written-practice-contract";
import { type SectionPreparation } from "../../../preparation/section-preparation";
import { type SyllabusView } from "../syllabus-contract";

export type NoticeSubject = {
  frequencySource?: TopicFrequencySource | null;
  group: string | null;
  /** A skills matrix's statements, when the topics are its contents (see `matrix` on the blueprint). */
  matrix?: readonly string[];
  name: string;
  /** Selected option folded into its parent notice subject, rather than displayed separately. */
  partOf?: string | null;
  questions: number | null;
  share: number | null;
  shortName: string | null;
  /** How often past exams asked each of its topics, by the topic's words, where something says. */
  topicFrequency?: ReadonlyMap<string, TopicFrequencyLevel>;
  /** The notice's heading each of its topics sits under, by the topic's words (ENEM's "Physics"). */
  topicHeadings?: ReadonlyMap<string, string>;
  topics: readonly string[];
  /** Written-task areas belong to the subject whose test asks them. */
  writtenTasks: readonly string[];
};

export type SyllabusSkill = {
  area: string;
  name: string;
  skillId: string;
  topics: readonly string[];
};

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

export type AreaCourse = { imageUrl: string | null; title: string };

export type SyllabusInput = {
  areaCourses: ReadonlyMap<string, AreaCourse>;
  chapterTitles: ReadonlyMap<string, string>;
  /** Defaults true; without a deadline, set-aside lessons mean failed library writing and leave lesson scope. */
  deadline?: boolean;
  /** The plan's lessons in plan order. */
  items: readonly SyllabusItem[];
  notice: {
    courseWeights: SyllabusView["courseWeights"];
    /** Read from the learner's own material (a class test's slides or notes), not a notice. */
    fromMaterial: boolean;
    passMarks: PassMarks | null;
    questionsSource: SyllabusView["questionsSource"];
    subjects: readonly NoticeSubject[];
    url: string | null;
  } | null;
  /** Known skills remain in practice even without planned lessons. */
  knownSkillIds: ReadonlySet<string>;
  /** Missing means no early-lesson requests; later untaught skills may request their outline early. */
  outlinedUntil?: string | null;
  /** Subject basics skipped by the starting point, distinct from lessons cut for time. */
  pastBasicsSkillIds: ReadonlySet<string>;
  /** Exam preparation only; other goals measure lessons. */
  sections?: readonly SectionPreparation[] | null;
  skills: readonly SyllabusSkill[];
  skippedAreas: readonly string[];
  /** Chosen skips are not confirmed knowledge. */
  skippedBaseIds?: ReadonlySet<string>;
  /** Stand-in skills chapters already teach (`listTaughtStandInSkills`): none to ask for early. */
  taughtSkillIds?: ReadonlySet<string>;
  /** Prioritizes Today's next lesson; omission falls back to plan order. */
  todayBlocks?: readonly TodayLearnBlock[];
  writtenPractice?: WrittenPractice | null;
};
