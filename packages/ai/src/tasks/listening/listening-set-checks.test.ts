import { describe, expect, it } from "vitest";
import { findListeningSetProblems, repairListeningSet } from "./listening-set-checks";
import { type ListeningQuestion, type ListeningSet } from "./listening-set-schema";

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

function typed(evidence: string, answer: string): ListeningQuestion {
  return {
    acceptedAnswers: [answer],
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

describe(findListeningSetProblems, () => {
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
});
