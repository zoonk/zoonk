import { describe, expect, it } from "vitest";
import { findListeningSetProblems, repairListeningSet } from "./listening-set-checks";
import { type ListeningQuestion, type ListeningSet, toListeningItem } from "./listening-set-schema";

const REQUEST = {
  count: 2,
  formats: ["multipleChoice", "typed"],
  optionCount: 3,
  skillCount: 2,
} as const;

function choice(evidence: string, question: string): ListeningQuestion {
  return {
    context: null,
    difficulty: "medium",
    evidence,
    format: "multipleChoice",
    options: [
      {
        isCorrect: true,
        misconception: null,
        reason: "Said after the correction.",
        text: "Thursday",
      },
      {
        isCorrect: false,
        misconception: "Takes the first day",
        reason: "Corrected.",
        text: "Tuesday",
      },
      { isCorrect: false, misconception: "Guesses", reason: "Never said.", text: "Friday" },
    ],
    question,
    skill: 1,
  };
}

type TypedQuestion = Extract<ListeningQuestion, { format: "typed" }>;

function typed(evidence: string, answer: string): TypedQuestion {
  return {
    acceptedAnswers: [answer],
    answerLimit: { plusNumber: false, words: 1 },
    context: "Booking form. Surname: ____",
    difficulty: "easy",
    evidence,
    format: "typed",
    keyPoints: [`The surname ${answer}`],
    question: "Write the surname, no more than one word.",
    sampleAnswer: answer,
    skill: 3,
  };
}

const LINES = [
  "Good morning, Riverside Sports Centre, how can I help?",
  "Hi, I'd like to book the small hall for a party, please.",
  "Of course. Can I take your surname?",
  "It's Hadley, H-A-D-L-E-Y.",
  "Thank you. And which day were you thinking of?",
  "Tuesday, no, sorry, Thursday the twelfth would be best for us.",
];

function scriptOf(lines: readonly string[]): ListeningSet["turns"] {
  return lines.map((text, index) => ({ speaker: index % 2 === 0 ? "Receptionist" : "Tom", text }));
}

function setOf(overrides: Partial<ListeningSet> = {}): ListeningSet {
  return {
    questions: [
      choice("Thursday the twelfth would be best", "Which day does Tom want the hall?"),
      typed("It's Hadley, H-A-D-L-E-Y.", "Hadley"),
    ],
    speakers: [
      { accent: "British English", gender: "female", name: "Receptionist" },
      { accent: "Australian English", gender: "male", name: "Tom" },
    ],
    title: "Booking a hall",
    turns: scriptOf(LINES),
    ...overrides,
  };
}

function femaleSpeakers(count: number): ListeningSet["speakers"] {
  return Array.from({ length: count }, (_, index) => ({
    accent: "British English",
    gender: "female",
    name: `Speaker ${index + 1}`,
  }));
}

describe(repairListeningSet, () => {
  it("drops what a voice would read aloud, joins one speaker's lines, puts questions in the order they're heard and keeps skills on the list", () => {
    const repaired = repairListeningSet(
      setOf({
        speakers: [
          { accent: "British English", gender: "female", name: "Receptionist" },
          { accent: "Australian English", gender: "male", name: "Tom" },
          { accent: "British English", gender: "male", name: "Narrator" },
        ],
        turns: [
          {
            speaker: "Receptionist",
            text: "[phone rings] Good morning — Riverside Sports Centre.",
          },
          { speaker: "Receptionist", text: "How can I *help*?" },
          { speaker: "Tom", text: "(laughs)" },
          ...scriptOf(LINES).slice(1),
        ],
      }),
      REQUEST,
    );

    expect(repaired.turns.slice(0, 2)).toStrictEqual([
      { speaker: "Receptionist", text: "Good morning, Riverside Sports Centre. How can I help?" },
      { speaker: "Tom", text: LINES[1] },
    ]);

    expect(repaired.speakers.map((speaker) => speaker.name)).toStrictEqual(["Receptionist", "Tom"]);

    expect(repaired.questions.map(({ format, skill }) => [format, skill])).toStrictEqual([
      ["typed", 1],
      ["multipleChoice", 1],
    ]);
  });

  it("keeps a talk's paragraphs, so its transcript reads in paragraphs", () => {
    const paragraphs = [
      "Welcome to Westbrook Community Centre. I'm Lucy, the centre manager.",
      "The public entrance is on Mill Lane, at the back of the building.",
    ];

    const repaired = repairListeningSet(
      setOf({
        speakers: [{ accent: "British English", gender: "female", name: "Lucy" }],
        turns: paragraphs.map((text) => ({ speaker: "Lucy", text })),
      }),
      REQUEST,
    );

    expect(repaired.turns).toStrictEqual(paragraphs.map((text) => ({ speaker: "Lucy", text })));
  });

  it("drops a title that gives an answer away, since it shows before the questions", () => {
    expect(repairListeningSet(setOf({ title: "The Hadley party" }), REQUEST).title).toBe("");
    expect(repairListeningSet(setOf({ title: "A Thursday booking" }), REQUEST).title).toBe("");

    expect(repairListeningSet(setOf({ title: "Booking a hall" }), REQUEST).title).toBe(
      "Booking a hall",
    );
  });

  it("keeps only as many questions as asked for", () => {
    const set = setOf();
    const extra = choice("Can I take your surname?", "What does the receptionist ask first?");

    expect(
      repairListeningSet({ ...set, questions: [...set.questions, extra] }, REQUEST).questions,
    ).toHaveLength(2);
  });
});

function gap({
  acceptedAnswers,
  context,
  plusNumber,
  sampleAnswer,
}: {
  acceptedAnswers: string[];
  context: string;
  plusNumber: boolean;
  sampleAnswer: string;
}): ListeningQuestion {
  return {
    ...typed("It's Hadley, H-A-D-L-E-Y.", sampleAnswer),
    acceptedAnswers,
    answerLimit: { plusNumber, words: 1 },
    context,
    question: plusNumber ? "Write ONE WORD AND/OR A NUMBER." : "Write ONE WORD ONLY.",
  };
}

describe(toListeningItem, () => {
  it("keeps only answers within the stated limit that don't repeat the word beside the gap", () => {
    const item = toListeningItem(
      gap({
        acceptedAnswers: ["towel", "a towel"],
        context: "Exercise classes: bring a ______",
        plusNumber: false,
        sampleAnswer: "a towel",
      }),
    );

    expect(item).toMatchObject({ acceptedAnswers: ["towel"], sampleAnswer: "towel" });
  });

  it("reads the gap's neighbors only within its own sentence or field", () => {
    const item = toListeningItem(
      gap({
        acceptedAnswers: ["write", "spell"],
        context: "At the workshop, children learn how to ______. Write carefully.",
        plusNumber: false,
        sampleAnswer: "write",
      }),
    );

    expect(item).toMatchObject({ acceptedAnswers: ["write", "spell"], sampleAnswer: "write" });
  });

  it("counts a number written in digits as the number and a number written in words as words", () => {
    const item = toListeningItem(
      gap({
        acceptedAnswers: ["9:30", "9.30 a.m.", "nine thirty", "07702 554190", "4 nights", "£68"],
        context: "Departure time: (3) ______",
        plusNumber: true,
        sampleAnswer: "nine thirty",
      }),
    );

    expect(item).toMatchObject({
      acceptedAnswers: ["9:30", "9.30 a.m.", "07702 554190", "4 nights", "£68"],
      sampleAnswer: "9:30",
    });
  });
});

describe(findListeningSetProblems, () => {
  it("hears a number answer through the sample's spoken words when only digits fit the limit", () => {
    const set = setOf({
      questions: [
        choice("Thursday the twelfth would be best", "Which day does Tom want the hall?"),
        gap({
          acceptedAnswers: ["12", "12th"],
          context: "Day booked: Thursday ______",
          plusNumber: true,
          sampleAnswer: "the twelfth",
        }),
      ],
    });

    expect(findListeningSetProblems(set, REQUEST)).toStrictEqual([]);
  });

  it("flags a typed question none of whose accepted answers fits its limit and gap", () => {
    const set = setOf({
      questions: [
        choice("Thursday the twelfth would be best", "Which day does Tom want the hall?"),
        gap({
          acceptedAnswers: ["a Thursday", "Thursday the twelfth"],
          context: "Day booked: a ______",
          plusNumber: false,
          sampleAnswer: "Thursday the twelfth",
        }),
      ],
    });

    expect(findListeningSetProblems(set, REQUEST)).toStrictEqual([
      `"Write ONE WORD ONLY.": none of its accepted answers fits its word limit and gap.`,
    ]);
  });

  it("finds no problem in a clean set", () => {
    const set = repairListeningSet(setOf(), REQUEST);
    expect(findListeningSetProblems(set, REQUEST)).toStrictEqual([]);
  });

  it("flags evidence the script doesn't say, a typed answer nobody says and a short set", () => {
    const set = repairListeningSet(
      setOf({
        questions: [
          choice("Wednesday would be best", "Which day does Tom want the hall?"),
          typed("Can I take your surname?", "Smith"),
        ],
      }),
      { ...REQUEST, count: 3 },
    );

    expect(findListeningSetProblems(set, { ...REQUEST, count: 3 })).toStrictEqual([
      "Wrote 2 questions instead of 3.",
      `"Write the surname, no more than one word.": none of its accepted answers is said in the script.`,
      `"Which day does Tom want the hall?": its evidence isn't in the script word for word.`,
    ]);
  });

  it("flags lines said by someone who isn't a speaker and a script too short to be a recording", () => {
    const set = setOf({
      turns: [{ speaker: "Anna", text: "Thursday the twelfth would be best." }],
    });

    expect(findListeningSetProblems(set, REQUEST)).toStrictEqual(
      expect.arrayContaining([
        "Lines are said by people not in the speakers: Anna.",
        "The script has 6 words; a recording needs at least 40.",
      ]),
    );
  });

  it("takes as many speakers as there are voices to tell them apart, and flags one more", () => {
    const eight = findListeningSetProblems(setOf({ speakers: femaleSpeakers(8) }), REQUEST);
    const nine = findListeningSetProblems(setOf({ speakers: femaleSpeakers(9) }), REQUEST);

    expect(eight.join("\n")).not.toContain("female speakers");
    expect(nine).toContain("Has 9 female speakers; only 8 voices tell them apart.");
  });

  it("asks for notation in a spoken line to be written as the words a speaker says", () => {
    const set = setOf({
      turns: scriptOf([
        ...LINES.slice(0, -1),
        "Thursday the twelfth would be best. I'll bring the file, data/x_1.csv, with a_n in it.",
      ]),
    });

    expect(findListeningSetProblems(set, REQUEST)).toStrictEqual([
      `A spoken line has written notation a voice can't say: "data/x_1.csv". Write it as the words a speaker would say.`,
      `A spoken line has written notation a voice can't say: "a_n". Write it as the words a speaker would say.`,
    ]);
  });

  it("counts the words of a script written without spaces", () => {
    const set = setOf({
      turns: scriptOf([
        "すみません、来週の木曜日に会議室を予約したいのですが、空いていますか。",
        "はい、木曜日の午後なら空いています。何名様でご利用になりますか。",
        "十二人です。プロジェクターも使いたいのですが、借りられますか。",
        "はい、プロジェクターは無料でお貸しできます。お名前をお願いします。",
      ]),
    });

    expect(findListeningSetProblems(set, REQUEST).join("\n")).not.toContain("The script has");
  });
});
