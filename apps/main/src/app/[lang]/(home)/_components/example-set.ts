type ExamSubject = { id: string; name: string; share: number };

export type ExamLesson = {
  essay?: boolean;
  id: string;
  minutes: number;
  subject: ExamSubject;
  title: string;
};

export type PlacedRow = {
  id: string;
  lessons?: number;
  state: "next" | "skipped" | "todo";
  title: string;
};

type ExamOption = { result?: "right" | "wrong"; text: string };

/** One country's exam, written in the page's language, since only that page shows it. */
export type ExamExample = {
  /** Its researched exam days come first while the Library course is published. */
  course?: { brandSlug: string; courseSlug: string };
  /** Published sittings in order; after the last one, later years keep its weekday until the list is updated. */
  sittings: readonly [string, ...string[]];
  /** Like `planName`, gets the exam month's name; a language that inflects it ("w maju") writes the month itself. */
  goal: (month: string) => string;
  mock: {
    score: string;
    scoreOf: string;
    topics: readonly { id: string; name: string; right: number; total: number }[];
  };
  name: string;
  /** The placement question's subject and its topics, from easiest. */
  placed: { rows: readonly PlacedRow[]; subject: ExamSubject };
  planName: (month: string) => string;
  practice: {
    answer: string;
    ask: string;
    context?: string;
    explanation: string;
    options: readonly ExamOption[];
    question: string;
    subject: ExamSubject;
  };
  subjects: readonly ExamSubject[];
  /** An IANA zone; the example counts days from today there. */
  timeZone: string;
  /** Today's lessons, which also come back tomorrow after a day without studying. */
  today: readonly [ExamLesson, ExamLesson, ExamLesson];
  tomorrow: { lessons: readonly [ExamLesson, ExamLesson, ...ExamLesson[]]; review: ExamLesson };
};

/** A spreadsheet's functions are named in its language, and countries with a decimal comma split with ";". */
type JobExample = {
  formulas: readonly [string, string, string];
  regions: readonly [ExampleRegion, ExampleRegion, ExampleRegion];
  result: string;
  sql: { orders: string; region: string; sales: string };
};

type ExampleRegion = { amount: number; id: string; name: string };

export type ExampleSet = {
  exam: ExamExample;
  job: JobExample;
  /** A page never suggests learning the language it's written in, so English pages move to Mexico City to speak Spanish. */
  move: "london" | "mexico-city";
};
