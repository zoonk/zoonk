import { serializeExerciseSteps } from "@repo/packages/core/src/player/contracts/prepare-lesson-data.ts";
import { SpeechPlayerProvider } from "@repo/packages/learn/src/speech/speech-player-provider.tsx";
import { LessonPlayerProvider } from "@repo/packages/player/src/lesson/lesson-player-provider.tsx";
import { LessonPlayerShell } from "@repo/packages/player/src/lesson/lesson-player-shell.tsx";
import { PlayerPreview } from "@repo/packages/player/src/preview/player-preview.tsx";
import {
  getPreviewEntry,
  previewLesson,
} from "@repo/packages/player/src/preview/preview-catalog.ts";
import { buildLesson } from "@repo/packages/player/src/preview/preview-lesson.ts";
import { localAdapters } from "@repo/packages/player/src/preview/preview-lesson.ts";
import { activityStep, contentStep } from "@repo/packages/player/src/preview/preview-steps.ts";
import { activityContentFixtures } from "@repo/packages/testing/src/fixtures/activity-contents.ts";
import { engineModeFixtures } from "@repo/packages/testing/src/fixtures/activity-contents/engine-modes.ts";
// Lesson player views: the real player components with the video's content per locale.
import { useMemo } from "react";
import { story } from "./story";

type Lang = "en" | "pt";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function choice(question: string, options: [string, boolean, string][]) {
  return {
    kind: "choice" as const,
    options: options.map(([text, isCorrect, reason], index) => ({
      id: `o${index}`,
      isCorrect,
      reason,
      text,
    })),
    question,
  };
}

/* Six activities from the real registry, with their fixture content (translated for pt). */
function activityContent(key: string, lang: Lang): { title: string; content: any } {
  const pt = lang === "pt";
  switch (key) {
    case "timeline": {
      const c = clone(activityContentFixtures.timeline) as any;
      if (pt) {
        c.prompt = "Posicione cada evento na linha do tempo.";
        c.fields.anchors[0].label = "Grande Pirâmide construída";
        c.fields.events[0].label = "Chegada do homem à Lua";
        c.fields.events[1].label = "Cleópatra governa o Egito";
      }
      return {
        content: c,
        title: pt ? "Datas que marcaram a história" : "Dates that shaped history",
      };
    }
    case "map": {
      const c = clone(activityContentFixtures.mapExplorer) as any;
      if (pt) {
        c.prompt = "Toque no mapa para achar pistas.";
        const [pump, brewery, workhouse] = c.fields.places;
        pump.label = "Bomba d'água da Broad Street";
        pump.reveals = "A maioria das mortes foi em casas a poucas ruas desta bomba.";
        brewery.label = "Cervejaria da Broad Street";
        brewery.reveals =
          "Mais de 70 funcionários e nenhuma morte por cólera. Eles bebiam cerveja e tinham o próprio poço.";
        workhouse.label = "Asilo da Poland Street";
        workhouse.reveals =
          "535 pessoas moravam aqui e só 5 morreram. O lugar tinha o próprio poço.";
        c.check = choice("O que protegeu os cervejeiros e o asilo?", [
          [
            "A água deles não vinha da bomba da Broad Street",
            true,
            "Os dois tinham o próprio poço.",
          ],
          ["O ar nos prédios deles era mais limpo", false, "A cólera vinha da água, não do ar."],
        ]);
      }
      return {
        content: c,
        title: pt ? "Como John Snow parou a cólera" : "How John Snow stopped cholera",
      };
    }
    case "projectile": {
      const c = clone((engineModeFixtures as any).formulaModel.simulation);
      c.check = {
        ...c.check,
        question: pt ? "A que distância a bola cai a 45°?" : "How far does the ball land at 45°?",
      };
      if (pt) {
        c.prompt = "Mude o ângulo e veja onde a bola cai.";
        c.fields.title = "Projétil";
        c.fields.outputs[0].label = "Cai a";
        c.fields.outputs[1].label = "Altura máxima";
        c.fields.variables[0].label = "Ângulo de lançamento";
        c.fields.variables[1].label = "Velocidade";
      }
      return { content: c, title: pt ? "Movimento de projéteis" : "Projectile motion" };
    }
    case "polls": {
      const c = clone((engineModeFixtures as any).randomSimulation.sampling);
      if (pt) {
        c.prompt = "Faça 200 pesquisas de cada tamanho.";
        c.fields.populationLabel = "Cidade de exemplo";
        c.fields.sizeLabel = "Pessoas por pesquisa";
        c.check = {
          kind: "choice",
          options: [
            {
              id: "o0",
              isCorrect: true,
              reason: "O erro cai com a raiz do tamanho da amostra.",
              text: "Pela metade",
              value: 0.5,
            },
            {
              id: "o1",
              isCorrect: false,
              reason: "Seria preciso 16 vezes mais pessoas.",
              text: "Um quarto do tamanho",
              value: 0.25,
            },
            {
              id: "o2",
              isCorrect: false,
              reason: "Amostras maiores erram menos.",
              text: "Igual",
              value: 1,
            },
          ],
          question: "Perguntar a 4 vezes mais pessoas deixa o erro…",
        };
      }
      return { content: c, title: pt ? "Como funcionam as pesquisas" : "How polls work" };
    }
    case "code": {
      const c = clone(activityContentFixtures.codeRunner) as any;
      if (pt) {
        c.prompt = "Corrija o laço para somar todos os números inteiros de 1 a 100.";
        c.fields.mistakes[0].feedback = "O range para antes do fim.";
      }
      return { content: c, title: pt ? "Laços em Python" : "Loops in Python" };
    }
    case "piano": {
      const c = clone((engineModeFixtures as any).keyboardFretboard.byEarChoice);
      if (pt) {
        c.prompt = "Toque o acorde. Ele soa maior ou menor?";
        c.check = choice("O que você ouviu?", [
          ["Um acorde maior", false, "O acorde maior soa mais claro."],
          ["Um acorde menor", true, "A terça menor deixa o som mais triste."],
        ]);
      }
      return { content: c, title: pt ? "Acordes maiores e menores" : "Major and minor chords" };
    }
    default:
      throw new Error(`unknown activity ${key}`);
  }
}

function lessonLanguage(lang: Lang) {
  return lang === "pt" ? "pt" : "en";
}

function Act({ lang, state, k }: { k: string; lang: Lang; state: string }) {
  const lesson = useMemo(() => {
    const { content, title } = activityContent(k, lang);
    return buildLesson([activityStep({ content, id: `act-${k}` })], {
      id: `lesson-${k}`,
      language: lessonLanguage(lang),
      title,
    });
  }, [k, lang]);
  return <PlayerPreview lesson={lesson} state={state as any} />;
}

/* A check question answered wrong, from the data analyst story. */
function averagesLesson(lang: Lang, withSecond = false) {
  const pt = lang === "pt";
  const check = pt
    ? {
        basis: null,
        options: [
          {
            id: "mean",
            isCorrect: false,
            reason:
              "Um salário enorme puxa a média para cima, então ela não descreve ninguém aqui.",
            text: "A média",
          },
          {
            id: "median",
            isCorrect: true,
            reason: "O valor do meio não muda com um salário extremo.",
            text: "A mediana",
          },
          {
            id: "total",
            isCorrect: false,
            reason: "O total soma todo mundo. Ele não descreve uma pessoa.",
            text: "O total",
          },
        ],
        question:
          "Cinco pessoas ganham R$ 4 mil por mês e uma ganha R$ 200 mil. Qual número descreve melhor um salário típico aqui?",
      }
    : {
        basis: null,
        options: [
          {
            id: "mean",
            isCorrect: false,
            reason: "One huge salary pulls the average way up, so it describes nobody here.",
            text: "The average (mean)",
          },
          {
            id: "median",
            isCorrect: true,
            reason: "The middle value doesn't move with one extreme salary.",
            text: "The median",
          },
          {
            id: "total",
            isCorrect: false,
            reason: "The total adds everyone up. It doesn't describe one person.",
            text: "The total",
          },
        ],
        question:
          "Five people earn $40k a year and one earns $2 million. Which number best describes a typical salary here?",
      };
  const steps = [
    contentStep("check", { content: check, id: "5d2a0c3e-1b7f-4c8e-9a61-2f3b4c5d6e01" }),
  ];
  if (withSecond)
    steps.push(
      contentStep("check", { content: check, id: "5d2a0c3e-1b7f-4c8e-9a61-2f3b4c5d6e02" }),
    );
  return buildLesson(steps, {
    id: "5d2a0c3e-1b7f-4c8e-9a61-2f3b4c5d6e00",
    language: lessonLanguage(lang),
    title: pt ? "Médias que enganam" : "Averages that lie",
  });
}

function Averages({ lang }: { lang: Lang }) {
  const lesson = useMemo(() => averagesLesson(lang), [lang]);
  return <PlayerPreview lesson={lesson} state="answering" />;
}

/* The word screen of a language lesson, for the story's word. */
function wordLesson(lang: Lang) {
  const { learner, target, word: entry } = story[lang].language;
  const word = {
    audioUrl: `/audio/${entry.word}.mp3`,
    distractors: entry.distractors,
    id: "8b0d7c84-5d4b-4f43-9a51-6a3c2e7b1f11",
    pronunciation: entry.respelling,
    romanization: null,
    translation: entry.meaning,
    word: entry.word,
  };
  const id = "word-step";
  const [exercise] = serializeExerciseSteps({
    languages: { language: learner, targetLanguage: target },
    resources: {
      distractorWords: [],
      lessonSentences: [],
      lessonWords: [word],
      sentenceWords: [word],
    },
    steps: [{ content: {}, id, kind: "vocabulary", position: 0, sentence: null, word }],
  } as any);
  const step = {
    exercise,
    id,
    kind: "vocabulary",
    position: 0,
    skillId: null,
    wordHints: { note: entry.note, pronunciationTip: entry.tip },
  };
  return buildLesson([step as any], {
    id: "lesson-word",
    language: learner,
    targetLanguage: target,
    title: entry.lesson,
  } as any);
}

function Word({ lang }: { lang: Lang }) {
  const lesson = useMemo(() => wordLesson(lang), [lang]);
  return <PlayerPreview lesson={lesson} state="answering" />;
}

function Activity({ id, state }: { id: string; state: string }) {
  const entry = getPreviewEntry(id);
  if (!entry) return <p>no entry {id}</p>;
  return <PlayerPreview lesson={previewLesson(entry, state as any)} state={state as any} />;
}

/* Ask Zu inside a lesson: the real tutor UI, served by a local stand-in for the tutor API. */

const TUTOR_URL = "https://api.zoonk.video";
const ZU_ANSWER = {
  en: "Picture six friends at dinner. Five earn about $40k and one earns $2 million.\n\nTheir **average** is about $367k, but nobody at that table earns anything close to that. The **median** is the middle salary, $40k, so it describes a typical person here.",
  pt: "Pense em seis amigos num jantar. Cinco ganham uns R$ 4 mil, e um ganha R$ 200 mil.\n\nA **média** dá uns R$ 36 mil, mas ninguém na mesa ganha nada perto disso. A **mediana** é o salário do meio, R$ 4 mil, então ela descreve uma pessoa típica aqui.",
};

function installTutorApi(lang: Lang) {
  if ((globalThis as any).__tutorApi) return;
  (globalThis as any).__tutorApi = true;
  const realFetch = globalThis.fetch.bind(globalThis);
  let questions: any[] = [];
  const now = () => new Date("2026-11-03T15:00:00Z").toISOString();
  globalThis.fetch = (async (input: any, init?: any) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.origin !== TUTOR_URL) return realFetch(input, init);
    const m = /^\/v1\/questions\/([^/]+)(\/answers)?$/.exec(url.pathname);
    if (m && m[2]) {
      const enc = new TextEncoder();
      const text = ZU_ANSWER[lang];
      const words = text.split(/(?<=\s)/);
      const stream = new ReadableStream({
        async start(c) {
          const send = (e: any) =>
            c.enqueue(enc.encode(`data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`));
          send({ type: "start" });
          send({ id: "answer", type: "text-start" });
          for (const w of words) {
            send({ delta: w, id: "answer", type: "text-delta" });
            await new Promise((r) => setTimeout(r, (globalThis as any).__zuDelay ?? 45));
          }
          send({ id: "answer", type: "text-end" });
          send({ type: "finish" });
          send("[DONE]");
          questions = questions.map((q) =>
            q.id === m[1] ? { ...q, answer: text, status: "completed" } : q,
          );
          c.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "text/event-stream",
          "x-vercel-ai-ui-message-stream": "v1",
        },
      });
    }
    if (m) {
      const q = questions.find((x) => x.id === m[1]);
      return q ? Response.json(q) : Response.json({ error: "x" }, { status: 404 });
    }
    if (req.method === "POST") {
      const body = await req.json();
      const ctx = body.context ?? {};
      const q = {
        answer: null,
        context:
          ctx.kind === "step" || ctx.kind === "answer"
            ? { kind: ctx.kind, stepId: ctx.stepId, stepNumber: ctx.stepNumber }
            : { kind: ctx.kind },
        createdAt: now(),
        id: crypto.randomUUID(),
        planChange: null,
        question: body.question,
        status: "pending",
        toolOffer: null,
        updatedAt: now(),
      };
      questions = [...questions, q];
      return Response.json({ ...q, missionMoment: null }, { status: 201 });
    }
    return Response.json(
      questions.length
        ? {
            hasMore: false,
            id: "5d2a0c3e-1b7f-4c8e-9a61-2f3b4c5d6eff",
            lessonId: "5d2a0c3e-1b7f-4c8e-9a61-2f3b4c5d6e00",
            nextCursor: null,
            questions,
          }
        : null,
    );
  }) as any;
}

function PlainLink({ children, className, href, ref }: any) {
  return (
    <a className={className} href={href} onClick={(e) => e.preventDefault()} ref={ref}>
      {children}
    </a>
  );
}

function Tutored({ lang, finish = false }: { finish?: boolean; lang: Lang }) {
  installTutorApi(lang);
  const lesson = useMemo(() => averagesLesson(lang, !finish), [lang, finish]);
  const adapters = useMemo(() => {
    const local = localAdapters(lesson);
    return {
      ...local,
      completeLesson: () =>
        Promise.resolve({
          completion: {
            brainPower: 24,
            ceremony: null,
            correctCount: 5,
            energyDelta: 1,
            incorrectCount: 1,
            isFirstCompletion: true,
            nextReviewAt: "2026-11-04T12:00:00.000Z",
            reached: { energy: 80, level: null },
            seconds: 190,
            studyBlock: null,
            totalBrainPower: 4364,
          },
          status: "completed",
        }),
      getLessonPictures: () => Promise.resolve([]),
    };
  }, [lesson]);
  const pt = lang === "pt";
  const tutor = {
    buddy: { beltColor: "yellow", energy: 76, glasses: "round", kind: "zu", name: "Zu" },
    canAsk: true,
    connection: {
      apiUrl: TUTOR_URL,
      getHeaders: () => Promise.resolve({ Authorization: "Bearer video" }),
    },
    navigation: { linkComponent: PlainLink, loginHref: "/", subscriptionHref: "/" },
    suggestions: [
      { id: "simpler", label: pt ? "Explique de um jeito mais simples" : "Explain it more simply" },
      { id: "deeper", label: pt ? "Quero me aprofundar" : "I want to go deeper" },
      { id: "example", label: pt ? "Me dê outro exemplo" : "Give me another example" },
    ],
  };
  return (
    <SpeechPlayerProvider voice={() => Promise.resolve({ limit: null, status: "failed" }) as any}>
      <LessonPlayerProvider
        adapters={adapters as any}
        firstAnswer={null}
        lesson={lesson}
        linkComponent={PlainLink as any}
        onExit={() => null}
        routes={{ exit: "/", exitTo: null, nextLesson: null, signUp: "/", upgrade: "/" } as any}
        tutor={tutor as any}
        viewer={{ hasSession: true } as any}
      >
        <LessonPlayerShell />
      </LessonPlayerProvider>
    </SpeechPlayerProvider>
  );
}

export const views: Record<string, (p: { lang: Lang; state: string; q: URLSearchParams }) => any> =
  {
    activity: ({ q, state }) => <Activity id={q.get("id")!} state={state} />,
    act: ({ lang, q, state }) => <Act k={q.get("k")!} lang={lang} state={state} />,
    averages: ({ lang }) => <Averages lang={lang} />,
    word: ({ lang }) => <Word lang={lang} />,
    tutor: ({ lang }) => <Tutored lang={lang} />,
    complete: ({ lang }) => <Tutored finish lang={lang} />,
  };
