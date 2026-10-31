type ExamDayRow = {
  detail: string;
  kind: "essay" | "lesson" | "practice" | "review";
  minutes: number;
  title: string;
  /** One of the exam's `topics`, so the wall can show which ones today picked. */
  topic: string;
};

type MissedDayTopic = { subject: string; title: string };

type MockScore = { label: string; range: string };

/** One country's exam, written in the page's language, since only that page shows it. */
export type ExamExample = {
  /** Its researched exam days come first while the Library course is published. */
  course?: { brandSlug: string; courseSlug: string };
  day: readonly [ExamDayRow, ExamDayRow, ExamDayRow, ExamDayRow];
  /** Gets the exam month's name; a language that inflects it ("w maju") writes the month itself. */
  goal: (month: string) => string;
  /** A study plan kept in a spreadsheet, two days before today to two after. */
  missedDay: {
    file: string;
    goal: string;
    topics: readonly [
      MissedDayTopic,
      MissedDayTopic,
      MissedDayTopic,
      MissedDayTopic,
      MissedDayTopic,
    ];
  };
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
  /** Two video tabs a student left open, short enough to sit side by side on a phone. */
  tabs: readonly [string, string];
  /** An IANA zone; the example counts days from today there. */
  timeZone: string;
  topics: readonly string[];
};

export type ExampleSet = {
  exam: ExamExample;
  /** A page never suggests learning the language it's written in, so English pages move to Mexico City to speak Spanish. */
  move: "london" | "mexico-city";
};
