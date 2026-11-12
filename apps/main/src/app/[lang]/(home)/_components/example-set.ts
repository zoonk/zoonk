type ExamDayRow = {
  detail: string;
  kind: "essay" | "lesson" | "practice" | "review";
  minutes: number;
  title: string;
};

type MockScore = { label: string; range: string };

/** The goal box's example, with the month of the exam's next sitting. */
type DatedExamGoal = {
  /** Its researched exam days come first while the Library course is published. */
  course?: { brandSlug: string; courseSlug: string };
  /** Gets the exam month's name; a language that inflects it ("w maju") writes the month itself. */
  goal: (month: string) => string;
  /** Published sittings in order; after the last one, later years keep its weekday until the list is updated. */
  sittings: readonly [string, ...string[]];
  /** An IANA zone; the example counts days from today there. */
  timeZone: string;
};

/** The goal box's example, for exams with no shared date, like concursos. */
type UndatedExamGoal = { goal: string };

/** One country's exam, written in the page's language, since only that page shows it. */
type ExamExample = (DatedExamGoal | UndatedExamGoal) & {
  day: readonly [ExamDayRow, ExamDayRow, ExamDayRow, ExamDayRow];
  /** How people there say they want it, such as "Passar no concurso": the headline's first goal and the example plan's name. */
  headline: string;
  mock: {
    firm: readonly string[];
    details?: string;
    mistakes: number;
    name: string;
    review: readonly string[];
    scores: readonly [MockScore, ...MockScore[]];
  };
};

export type DatedExamExample = Extract<ExamExample, { sittings: unknown }>;

type CareerTopic = { lessons: number; title: string };

/** A career change people there make, as a plan that skipped its first topic and starts the next one today. */
type CareerExample = {
  /** Written to follow the goal box's "I want to". */
  goal: string;
  name: string;
  skipped: string;
  topics: readonly [CareerTopic, CareerTopic, CareerTopic, CareerTopic, CareerTopic];
};

type TopicExample = {
  chapters: readonly [string, string, string, string, string];
  laterChapters: number;
  name: string;
  /** This subject and two more like it, opening the section's lead: "Física quântica, história da arte, como funciona a bolsa de valores". */
  subjects: string;
};

export type ExampleSet = {
  career: CareerExample;
  exam: ExamExample;
  /** The exams people there study for, ending with a school test, as examples of "any exam": "concurso, Enem, OAB, vestibular ou prova da escola". */
  exams: string;
  /** A page never suggests learning the language it's written in, so English pages move to Mexico City to speak Spanish. */
  move: "london" | "mexico-city";
  topic: TopicExample;
};
