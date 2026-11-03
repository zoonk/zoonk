type ExamDayRow = {
  detail: string;
  kind: "essay" | "lesson" | "practice" | "review";
  minutes: number;
  title: string;
};

type MockScore = { label: string; range: string };

/** One country's exam, written in the page's language, since only that page shows it. */
export type ExamExample = {
  /** Its researched exam days come first while the Library course is published. */
  course?: { brandSlug: string; courseSlug: string };
  day: readonly [ExamDayRow, ExamDayRow, ExamDayRow, ExamDayRow];
  /** Gets the exam month's name; a language that inflects it ("w maju") writes the month itself. */
  goal: (month: string) => string;
  /** How people there say they want it, such as "Passar no Enem": the headline's first goal and the example plan's name. */
  headline: string;
  mock: {
    firm: readonly string[];
    details?: string;
    mistakes: number;
    name: string;
    review: readonly string[];
    scores: readonly [MockScore, ...MockScore[]];
  };
  name: string;
  /** Published sittings in order; after the last one, later years keep its weekday until the list is updated. */
  sittings: readonly [string, ...string[]];
  /** An IANA zone; the example counts days from today there. */
  timeZone: string;
};

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
  /** The exams people there study for, opening the exams section's lead: "Enem, vestibular, concurso ou OAB". */
  exams: string;
  /** A page never suggests learning the language it's written in, so English pages move to Mexico City to speak Spanish. */
  move: "london" | "mexico-city";
  topic: TopicExample;
};
