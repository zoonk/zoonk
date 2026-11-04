// A mock exam (/mock/[blockId]): in progress, and its result, from story.exam.mock.
import { MockScreen } from "@repo/packages/learn/src/mock/mock-screen.tsx";
import { story, type Lang } from "../story";
import { Learn, NOOP, NOOP_ASYNC } from "./shell";

/** The question on screen, its options worked out from the story's question. */
const QUESTION: Record<
  Lang,
  { area: string; options: string[]; picked: number | null; text: string }
> = {
  en: {
    area: "Math",
    options: ["3", "5", "7", "29/3"],
    picked: 1,
    text: story.en.exam.mistakes[0][0],
  },
  pt: {
    area: "Matemática",
    options: ["R$ 85,00", "R$ 100,00", "R$ 105,00", "R$ 120,00", "R$ 60,00"],
    picked: null,
    text: story.pt.exam.mistakes[0][0],
  },
};

/** en: a two-part SAT practice test; pt: Enem's second day, one 5-hour block. */
function sections(lang: Lang, running: boolean) {
  const { mock } = story[lang].exam;
  const total = mock.right + mock.wrong + mock.blank;

  if (lang === "pt") {
    return [
      {
        breakAfterMinutes: null,
        essays: 0,
        index: 0,
        minutes: 300,
        name: null,
        navigation: null,
        questions: total,
        status: running ? "current" : "done",
        tools: null,
      },
    ];
  }

  const half = total / 2;
  return [
    {
      breakAfterMinutes: 10,
      essays: 0,
      index: 0,
      minutes: 32,
      name: mock.areas[0][0],
      navigation: null,
      questions: half,
      status: "done",
      tools: null,
    },
    {
      breakAfterMinutes: null,
      essays: 0,
      index: 1,
      minutes: 35,
      name: mock.areas[1][0],
      navigation: null,
      questions: half,
      status: running ? "current" : "done",
      tools: null,
    },
  ];
}

function runningSection(lang: Lang) {
  const { mock } = story[lang].exam;
  const total = mock.right + mock.wrong + mock.blank;
  const count = lang === "pt" ? total : total / 2;
  const firstNumber = lang === "pt" ? 91 : 1;
  const at = lang === "pt" ? 46 : 6;
  const question = QUESTION[lang];
  const otherArea = lang === "pt" ? mock.areas[0][0] : question.area;

  const questions = Array.from({ length: count }, (_, index) => {
    const own = index === at;
    return {
      area: lang === "pt" ? (index < 45 ? otherArea : question.area) : question.area,
      context: null,
      entry: null,
      format: "multipleChoice",
      image: null,
      itemId: `item-${index}`,
      number: firstNumber + index,
      options: own ? question.options : question.options.map((_, i) => String(i)),
      question: own ? question.text : `${index}`,
      select: null,
      set: null,
      skillId: "skill",
      unit: null,
      visual: null,
    };
  });

  const drafts = questions
    .slice(0, at)
    .map((item, index) => ({
      answer: { selectedIndex: index % 4 },
      durationMs: 70_000,
      flagged: index === 2,
      itemId: item.itemId,
    }));

  if (question.picked !== null) {
    drafts.push({
      answer: { selectedIndex: question.picked },
      durationMs: 40_000,
      flagged: false,
      itemId: questions[at].itemId,
    });
  }

  const minutesLeft = lang === "pt" ? 151 : 26;

  return {
    changesLeft: null,
    deadline: new Date(Date.now() + minutesLeft * 60_000 + 42_000).toISOString(),
    drafts,
    kind: null,
    plays: [],
    questions,
    resume: at,
    section: lang === "pt" ? 0 : 1,
  };
}

function result(lang: Lang) {
  const { mock } = story[lang].exam;
  const total = mock.right + mock.wrong + mock.blank;
  const half = Math.round(total / 2);
  const rights = lang === "pt" ? [24, 28] : [15, 16];
  const low = mock.low;
  const high = mock.high;

  return {
    areas: mock.areas.map(([name, areaLow, areaHigh], index) => ({
      correct: rights[index],
      name,
      score: { high: areaHigh, low: areaLow, score: Math.round((areaLow + areaHigh) / 2) },
      secondsPerQuestion: lang === "pt" ? 175 : 92,
      targetSecondsPerQuestion: lang === "pt" ? 180 : 95,
      total: half,
    })),
    blank: mock.blank,
    calibration: null,
    coherence: null,
    correct: mock.right,
    irt: { high, low, score: Math.round((low + high) / 2), se: 25, theta: 0.4 },
    minutesUsed: lang === "pt" ? 271 : 61,
    net: null,
    plannedMinutes: lang === "pt" ? 300 : 67,
    points: null,
    preparation: {
      after: story[lang].exam.preparation + 0.04,
      before: story[lang].exam.preparation,
    },
    previous: null,
    scoring: "irt",
    topics: [],
    total,
    unansweredAtTimeout: 0,
  };
}

function mockView(lang: Lang, state: "running" | "finished") {
  const exam = story[lang].exam;
  const running = state === "running";
  const total = exam.mock.right + exam.mock.wrong + exam.mock.blank;

  return {
    adapt: null,
    blockId: "mock",
    brainPower: running ? 0 : 120,
    breakUntil: null,
    canMove: false,
    ceremony: null,
    checklist: [],
    current: running ? runningSection(lang) : null,
    date: "2026-11-03",
    day: lang === "pt" ? 2 : null,
    essayRubric: null,
    leftOut: [],
    essays: [],
    examDocument: "notice",
    examName: exam.name,
    examQuestions: total,
    fullLength: lang === "pt",
    goalId: "exam",
    minutes: lang === "pt" ? 300 : 67,
    missionMoment: null,
    mistakes: [
      { cause: "contentGap", count: 4 },
      { cause: "misread", count: 3 },
      { cause: "trap", count: 2 },
    ],
    number: 1,
    passMarks: null,
    planItemId: "mock-item",
    purpose: "planned",
    questions: total,
    reached: { energy: null, level: null },
    result: running ? null : result(lang),
    reusedQuestions: 0,
    review: [],
    scoring: "irt",
    scoringNote: null,
    sections: sections(lang, running),
    sessionId: null,
    shape:
      lang === "pt"
        ? { area: null, day: 2, kind: "full" }
        : { area: null, day: null, kind: "half" },
    scoreNotes: { noticeScoring: null, relative: false, scale: null },
    speaking: null,
    sizeSource: {
      formats: "notice",
      material: false,
      pastEdition: null,
      questions: "notice",
      subjects: "notice",
      time: "notice",
    },
    startTime: null,
    status: running ? "running" : "finished",
    timeZone: "America/Sao_Paulo",
    trueFalseLabels: { false: "False", true: "True" },
  } as any;
}

const ACTIONS = {
  adapt: NOOP_ASYNC,
  answer: NOOP_ASYNC,
  endBreak: NOOP_ASYNC,
  finish: NOOP_ASYNC,
  gradeEssays: NOOP_ASYNC,
  play: NOOP_ASYNC,
  refresh: NOOP,
  startSpeaking: NOOP_ASYNC,
  submit: NOOP_ASYNC,
} as any;

const HREFS = {
  again: "/challenge/mock-item",
  continue: "/today",
  exit: "/today",
  mistakes: "/mistakes",
  speakingTask: () => "/conversation/x",
};

export function Mock({ lang, state }: { lang: Lang; state: "running" | "finished" }) {
  return (
    <Learn>
      <MockScreen actions={ACTIONS} buddy={null} hrefs={HREFS} mock={mockView(lang, state)} />
    </Learn>
  );
}
