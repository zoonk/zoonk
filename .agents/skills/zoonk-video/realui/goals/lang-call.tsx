import { ConversationLive } from "@repo/packages/learn/src/language/conversation/conversation-live.tsx";
// The practice call (/conversation/[id]) mid-call and after it, plus the IELTS speaking mock result.
import { ConversationScreen } from "@repo/packages/learn/src/language/conversation/conversation-screen.tsx";
import { useEffect } from "react";
import { story, type Lang } from "../story";
import { LangLearn as Learn } from "./lang-frame";
import { NOOP, NOOP_ASYNC } from "./shell";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/**
 * Call details story.ts doesn't hold yet (objective labels, the learner's line the fix quotes, the
 * second word's respelling). Values in story.language.call of the same name win.
 */
const CALL_EXTRA = {
  en: {
    objectives: [
      ["Decir cuánto tiempo te quedas", "Say how long you'll stay."],
      ["Preguntar qué incluye la renta", "Ask what the rent includes."],
      ["Preguntar por el depósito", "Ask about the deposit."],
    ],
    met: 0,
    metAfter: [0, 2],
    said: "Seis meses.",
    better: "Me voy a quedar seis meses.",
    respellings: {
      depósito: [
        "deh-POH-see-toh",
        "Stress the second syllable: deh-POH-see-toh, not DEH-po-see-toh.",
      ],
    },
  },
  pt: {
    objectives: [
      ["Say why you're here", "Diga o motivo da viagem."],
      ["Say where you'll stay", "Diga onde vai ficar."],
      ["Say how long you'll stay", "Diga quanto tempo vai ficar."],
    ],
    met: 0,
    metAfter: [0, 1],
    said: "I stay with a friend.",
    better: "I'll be staying with a friend.",
    respellings: {
      purpose: [
        "PÂR-pâs",
        "O r vem logo depois da vogal e quase não aparece: PÂR-pâs, não pur-PÓ-zi.",
      ],
    },
  },
} as const;

function callParts(lang: Lang) {
  const language = story[lang].language;
  const call = language.call as any;
  const extra = CALL_EXTRA[lang] as any;
  const [role, place = ""] = String(call.role).split(" · ");
  const objectives: [string, string][] = call.objectives ?? extra.objectives;
  return { call, extra, language, objectives, place, role };
}

function conversationView(lang: Lang, met: number[]) {
  const { call, language, objectives, place, role } = callParts(lang);

  return {
    character: { name: call.character, place, role },
    exam: null,
    examTask: null,
    goalId: id(1),
    hints: [],
    id: id(4),
    kind: "practice",
    level: "A2",
    locked: false,
    minutes: 5,
    objectives: objectives.map(([label, description], index) => ({
      description,
      label,
      met: met.includes(index),
    })),
    openingLine: call.lines[0][1],
    result: null,
    situation: "",
    status: "ready",
    targetLanguage: language.target,
    title: language.units[0][0],
    unit: { chapterId: id(3), title: language.units[0][0] },
  } as any;
}

const HREFS = { exit: "/today", next: "/today" };
const ACTIONS = { complete: NOOP_ASYNC } as any;

export function CallLive({ lang }: { lang: Lang }) {
  const { call, extra, objectives } = callParts(lang);
  const conversation = conversationView(lang, []);

  const live = {
    elapsedSeconds: 74,
    error: null,
    finish: NOOP_ASYNC,
    hangUp: NOOP,
    isCapturing: true,
    isPlaying: true,
    limit: null,
    limitNear: null,
    limitSeconds: 300,
    metLabels: [objectives[extra.met]?.[0]],
    micBlocked: false,
    muted: false,
    phase: "live",
    reconnecting: false,
    sendText: NOOP,
    start: NOOP_ASYNC,
    toggleMute: NOOP,
    turn: {
      characterSpeaking: false,
      greeted: true,
      learnerSpeaking: false,
      quietHint: false,
      reason: null,
      saidGoodbye: false,
      spokeOutLoud: true,
    },
    turns: call.lines.map(([who, text]: [string, string]) => ({
      speaker: who === "me" ? "learner" : "character",
      text,
    })),
  } as any;

  return (
    <Learn>
      <ConversationLive
        call={live}
        conversation={conversation}
        onEnd={NOOP}
        onHelp={NOOP}
        usedHelp={false}
      />
    </Learn>
  );
}

/** Taps the Steps' Continue `steps` times, so a later step can be captured. */
export function useAdvance(steps: number) {
  useEffect(() => {
    let left = steps;
    let timer: ReturnType<typeof setTimeout>;

    const tap = () => {
      if (left <= 0) return;
      const button = document.querySelector<HTMLButtonElement>(
        'button[aria-keyshortcuts="Enter"]:not([disabled])',
      );
      if (button) {
        button.click();
        left -= 1;
      }
      timer = setTimeout(tap, 150);
    };

    timer = setTimeout(tap, 150);
    return () => clearTimeout(timer);
  }, [steps]);
}

const FEEDBACK_STEPS = ["stars", "well", "improve"];

export function CallFeedback({ lang, state }: { lang: Lang; state: string }) {
  const { call, extra, language, objectives } = callParts(lang);
  useAdvance(Math.max(0, FEEDBACK_STEPS.indexOf(state)));

  const respellings: Record<string, [string, string]> = { ...extra.respellings };
  respellings[language.word.word] = [language.word.respelling, language.word.tip];

  const pronunciation = (call.words as string[]).map((word) => {
    const known =
      respellings[word] ??
      (word.startsWith(language.word.word)
        ? [`${language.word.respelling}-in`, language.word.tip]
        : null);
    return { respelling: known?.[0] ?? "", tip: known?.[1] ?? "", word };
  });

  const conversation = {
    ...conversationView(lang, extra.metAfter),
    result: {
      brainPower: 30,
      feedback: {
        encouragement: call.wentWell,
        improve: {
          better: call.better ?? extra.better,
          said: call.said ?? extra.said,
          why: call.improve,
        },
        kind: "call",
        pronunciation,
        wentWell: call.lines
          .filter(([who]: [string]) => who === "me")
          .map(([, text]: [string, string]) => text),
      },
      passed: true,
      spokenSeconds: 160,
      stars: 2,
    },
    status: "completed",
  };

  return (
    <Learn>
      <ConversationScreen
        actions={ACTIONS}
        buddy={null}
        conversation={conversation}
        hrefs={HREFS}
      />
    </Learn>
  );
}

const SPEAKING_STEPS = ["band", "criteria", "focus"];

/** Story's band range ("6.5–7.0"), with criteria around it (fluency the focus). */
export function SpeakingResult({ lang, state }: { lang: Lang; state: string }) {
  useAdvance(Math.max(0, SPEAKING_STEPS.indexOf(state)));
  const speaking = ((story[lang].exam as any).speaking ?? story.en.exam.speaking) as {
    band: string;
    exam: string;
  };
  const [low, high = low] = speaking.band.split(/[–-]/).map(Number);
  const language = story[lang].language;

  const criteria = [
    ["fluencyCoherence", low, low],
    ["lexicalResource", low, high],
    ["grammar", low, low],
    ["pronunciation", high, high],
  ].map(([criterion, bandLow, bandHigh]) => ({
    bandHigh,
    bandLow,
    criterion,
    evidence: "",
    tip: "",
  }));

  const conversation = {
    ...conversationView(lang, []),
    exam: "ielts",
    kind: "speakingMock",
    objectives: [],
    result: {
      brainPower: 40,
      feedback: {
        criteria,
        exam: "ielts",
        focus: "fluencyCoherence",
        kind: "speakingMock",
        overall: { bandHigh: high, bandLow: low },
      },
      passed: true,
      spokenSeconds: 660,
      stars: 0,
    },
    status: "completed",
    targetLanguage: "en",
    title: language.units[0][0],
  };

  return (
    <Learn>
      <ConversationScreen
        actions={ACTIONS}
        buddy={null}
        conversation={conversation as any}
        hrefs={HREFS}
      />
    </Learn>
  );
}
