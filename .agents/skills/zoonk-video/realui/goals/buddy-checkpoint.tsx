// The Trickster phase challenge: its intro (/challenge), a question mid-duel and the win (/checkpoint).
import { ChallengeScreen } from "@repo/packages/learn/src/challenge/challenge-screen.tsx";
import { CheckpointScreen } from "@repo/packages/learn/src/checkpoints/checkpoint-screen.tsx";
import { useEffect } from "react";
import { type Lang, story } from "../story";
import { buddyStatus, tabBuddy } from "./buddy-energy";
import { Learn, NOOP_ASYNC } from "./shell";

/**
 * Answer options for story.exam.mistakes, by the same index; `right` is the correct option.
 * The passage question has none: it is answered before the one on screen.
 */
const OPTIONS: Record<Lang, ({ options: string[]; right: number } | null)[]> = {
  en: [
    { options: ["3", "5", "7", "15"], right: 1 },
    null,
    { options: ["$48", "$50", "$52", "$60"], right: 1 },
    { options: ["However", "For example", "As a result", "Similarly"], right: 2 },
    { options: ["new", "fictional", "long", "famous"], right: 0 },
  ],
  pt: [
    { options: ["R$ 96", "R$ 100", "R$ 105", "R$ 120"], right: 1 },
    null,
    { options: ["10%", "19%", "20%", "21%"], right: 1 },
    {
      options: [
        "Separa um aposto",
        "Isola um vocativo",
        "Marca a omissão de um verbo",
        "Separa orações coordenadas",
      ],
      right: 2,
    },
    { options: ["passageiro", "eterno", "delicado", "obscuro"], right: 0 },
  ],
};

const PASS_MARK = 7;
const QUESTIONS = 10;
const REWARD = { badge: false, brainPower: 200, glasses: null, phaseComplete: true };

/** The duel's order: the trap question comes fourth, after two right answers and one wrong. */
const ORDER = [0, 1, 4, 2, 3];

function topics(lang: Lang) {
  return story[lang].exam.subjects.flatMap((subject) =>
    subject.often.map((name) => ({ name, subject: subject.name })),
  );
}

function challengeView(lang: Lang, won: boolean) {
  return {
    blockId: "block",
    call: null,
    canMove: false,
    dailyLimitReached: false,
    date: "2026-11-03",
    estimatedMinutes: 12,
    examName: story[lang].exam.name,
    fullLength: false,
    goalId: "exam",
    kind: "boss",
    leftOut: [],
    locked: false,
    minutes: 12,
    mock: false,
    netScored: false,
    nextStudyDate: null,
    number: null,
    passMark: PASS_MARK,
    phase: { index: 0, name: "" },
    planItemId: "boss-0",
    questions: QUESTIONS,
    recordings: 0,
    reinforcementLessons: 0,
    rematch: false,
    result: won ? { correct: 8, passed: true, total: QUESTIONS } : null,
    reward: REWARD,
    sections: [],
    startTime: null,
    status: won ? "done" : "ready",
    timeZone: "America/Sao_Paulo",
    title: "",
    today: "2026-11-03",
    topics: topics(lang),
    waitReason: null,
    written: [],
    wrongPenalty: 0,
  } as any;
}

function question(
  lang: Lang,
  index: number,
  answered: { blank: boolean; isCorrect: boolean } | null,
) {
  const [text] = story[lang].exam.mistakes[index]!;
  const choice = OPTIONS[lang][index];

  return {
    answered,
    capsuleKey: null,
    citation: null,
    context: null,
    drill: null,
    format: "multipleChoice",
    image: null,
    itemId: `item-${index}`,
    mistakeId: null,
    options: choice?.options ?? null,
    placement: false,
    question: text,
    quoted: false,
    select: 1,
    set: null,
    skillId: `skill-${index}`,
    timeMachine: null,
    visual: null,
  };
}

function checkpointView(lang: Lang, won: boolean) {
  const verdicts = [true, true, false];
  const asked = ORDER.map((index, position) =>
    question(
      lang,
      index,
      won || position < verdicts.length
        ? { blank: false, isCorrect: won ? position !== 2 : verdicts[position]! }
        : null,
    ),
  );

  return {
    answeredQuestions: [
      // The rest of the eight, asked before the five shown here.
      { isCorrect: true, itemId: "earlier-1" },
      { isCorrect: true, itemId: "earlier-2" },
      { isCorrect: true, itemId: "earlier-3" },
      { isCorrect: false, itemId: "earlier-4" },
      { isCorrect: true, itemId: "earlier-5" },
    ].slice(0, won ? 5 : 0),
    blockId: "block",
    checklist: [],
    endedWithoutQuestions: false,
    kind: "boss",
    mock: false,
    nextPhase: { index: 1, name: "" },
    passMark: PASS_MARK,
    phase: { index: 0, name: "" },
    planItemId: "boss-0",
    questions: won
      ? asked
      : [
          ...asked,
          ...ORDER.map((index) => ({ ...question(lang, index, null), itemId: `item-${index}-b` })),
        ],
    reinforcementLessons: 0,
    rematch: false,
    result: won ? { correct: 8, passed: true, total: QUESTIONS } : null,
    retry: null,
    reward: REWARD,
    sessionId: "session",
    status: won ? "completed" : "inProgress",
    timeLimitMinutes: null,
    title: null,
    trueFalseLabels: "trueFalse",
  } as any;
}

/** Picks an option, then confirms it, as the learner's taps would. */
function Taps({ confirm, pick }: { confirm: boolean; pick: number | null }) {
  useEffect(() => {
    if (pick === null) return;
    const timers = [
      setTimeout(
        () =>
          document
            .querySelectorAll<HTMLElement>("[data-slot=checkpoint-question] button")
            [pick - 1]?.click(),
        120,
      ),
    ];
    if (confirm) {
      timers.push(
        setTimeout(
          () => document.querySelector<HTMLElement>('button[aria-keyshortcuts="Enter"]')?.click(),
          320,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [confirm, pick]);
  return null;
}

function Duel({ lang, q, won }: { lang: Lang; q: URLSearchParams; won: boolean }) {
  const checkpoint = checkpointView(lang, won);
  const pick = q.get("pick") ? Number(q.get("pick")) : null;
  const buddy = tabBuddy(buddyStatus({ energy: 82, lang, studied: true }));

  const actions = {
    answer: async ({ answer, itemId }: any) => {
      const index = Number(itemId.split("-")[1]);
      const right = OPTIONS[lang][index]?.right;
      return {
        isCorrect: answer.selectedIndex === right,
        reinforcementLessons: null,
        transcript: null,
      };
    },
    finish: NOOP_ASYNC,
  };

  return (
    <>
      <CheckpointScreen
        actions={actions as any}
        buddy={buddy as any}
        checkpoint={checkpoint}
        hrefs={{ continue: "/today", exit: "/today" }}
      />
      {!won && <Taps confirm={q.get("confirm") === "1"} pick={pick} />}
    </>
  );
}

function Intro({ lang, won }: { lang: Lang; won: boolean }) {
  return (
    <ChallengeScreen
      actions={{ move: NOOP_ASYNC, start: NOOP_ASYNC, undoMove: NOOP_ASYNC }}
      challenge={challengeView(lang, won)}
      hrefs={{ exit: "/today", open: won ? "/checkpoint/block" : null }}
      moved={null}
    />
  );
}

/** `state`: intro (the challenge page), question (mid-duel; `pick=<1-4>`, `confirm=1`), won (the result), won-intro. */
export function Checkpoint({ lang, q, state }: { lang: Lang; q: URLSearchParams; state: string }) {
  return (
    <Learn>
      {state === "intro" && <Intro lang={lang} won={false} />}
      {state === "won-intro" && <Intro lang={lang} won />}
      {(state === "question" || state === "answering") && <Duel lang={lang} q={q} won={false} />}
      {state === "won" && <Duel lang={lang} q={q} won />}
    </Learn>
  );
}
