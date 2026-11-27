import { WRITING_MAX_CHARACTERS_PER_LINE } from "@repo/packages/core/src/exams/essays/writing-lines.ts";
import { WritingScreen } from "@repo/packages/learn/src/writing/writing-screen.tsx";
import { type ComponentProps } from "react";
import { story } from "../story";
import { LangLearn } from "./lang-frame";

type Props = ComponentProps<typeof WritingScreen>;

const COMPETENCE_MAX = 200;
const RANGE_SPREAD = 40;

const ACTIONS: Props["actions"] = {
  finish: async () => false,
  saveDraft: async () => ({ status: "closed" }),
  start: async () => ({ status: "failed" }),
  submit: async () => null,
};

function essayView(q: URLSearchParams): Props["essay"] {
  const { comps, total } = story.pt.exam.essay;
  const max = COMPETENCE_MAX * comps.length;
  const weakest = comps.findIndex((score) => score === Math.min(...comps));
  const spread = Number(q.get("spread") ?? RANGE_SPREAD);
  const range = { high: Math.min(max, total + spread), low: Math.max(0, total - spread) };
  const rows = comps.map((earned, index) => ({ earned, id: `c${index + 1}`, max: COMPETENCE_MAX }));

  return {
    blockId: "00000000-0000-4000-8000-000000000005",
    context: null,
    draft: null,
    drafts: [
      {
        attemptId: "00000000-0000-4000-8000-000000000007",
        grade: {
          content: range,
          criteria: rows.map(({ id }, index) => ({
            comment: "",
            id,
            level: "strong",
            name: `C${index + 1}`,
            quote: null,
          })),
          deduction: { high: 0, low: 0 },
          errors: [],
          ignoredFrom: null,
          kind: "points",
          max,
          nextStep: { criterionId: `c${weakest + 1}`, example: null, quote: null, text: "" },
          progress: null,
          rows,
          total: range,
          zeroReason: null,
        },
        submittedAt: "2026-11-03T15:00:00.000Z",
        text: "",
      },
    ],
    gradesLeft: 2,
    pacing: { minutes: 60, source: "practice" },
    question: "",
    rubric: "enem",
    sessionId: "00000000-0000-4000-8000-000000000006",
    status: "active",
    writing: {
      charactersPerLine: 70,
      criteria: rows.map(({ id, max: points }, index) => ({ id, name: `C${index + 1}`, points })),
      keySource: "publishedStandard",
      lines: 30,
      maxCharactersPerLine: WRITING_MAX_CHARACTERS_PER_LINE,
      minimumWords: 0,
      points: max,
      taskKey: "essay",
      title: story.pt.exam.essay.title,
      unit: "answer",
    },
  };
}

export function Essay({ q }: { q: URLSearchParams }) {
  return (
    <LangLearn>
      <WritingScreen actions={ACTIONS} essay={essayView(q)} hrefs={{ exit: "/today" }} />
    </LangLearn>
  );
}
