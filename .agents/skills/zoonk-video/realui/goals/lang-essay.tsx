// The Enem essay's grade on the five competências (/essay/[blockId]), from story.pt.exam.essay.
import { EssayScreen } from "@repo/packages/learn/src/essay/essay-screen.tsx";
import { type ComponentProps } from "react";
import { actions } from "../learn/common";
import { story } from "../story";
import { LangLearn } from "./lang-frame";

type Props = ComponentProps<typeof EssayScreen>;

const COMPETENCE_MAX = 200;
/** The estimate's half width around the story's total (760 reads "720–800"). */
const RANGE_SPREAD = 40;

export function essayView(q: URLSearchParams): Props["essay"] {
  const essay = story.pt.exam.essay;
  const comps = essay.comps as readonly number[];
  const weakest = comps.indexOf(Math.min(...comps));
  const spread = Number(q.get("spread") ?? RANGE_SPREAD);

  const grade = {
    criteria: comps.map((score, index) => ({
      comment: "",
      example: null,
      id: `c${index + 1}`,
      maxScore: COMPETENCE_MAX,
      name: `C${index + 1}`,
      quote: null,
      score,
    })),
    enemInterventionElements: {
      action: true,
      agent: true,
      detail: true,
      effect: true,
      means: true,
    },
    nextStep: { criterionId: `c${weakest + 1}`, text: "" },
    range: { high: Math.min(1000, essay.total + spread), low: Math.max(0, essay.total - spread) },
    total: { maxScore: COMPETENCE_MAX * comps.length, score: essay.total },
    zeroReason: null,
  };

  return {
    blockId: "00000000-0000-4000-8000-000000000005",
    context: null,
    drafts: [{ grade, submittedAt: "2026-11-03T15:00:00.000Z", text: "" }],
    gradesLeft: 2,
    question: "",
    rubric: "enem",
    sessionId: "00000000-0000-4000-8000-000000000006",
    status: "active",
  };
}

export function Essay({ q }: { q: URLSearchParams }) {
  return (
    <LangLearn>
      <EssayScreen
        actions={actions<Props["actions"]>({})}
        essay={essayView(q)}
        hrefs={{ exit: "/today" }}
      />
    </LangLearn>
  );
}
