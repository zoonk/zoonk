import { useEffect } from "react";
import { type Lang } from "../story";
import { Mistakes } from "./mistakes";
import { Mock } from "./mock";
import { ExamPlan } from "./plan";
import { ExamSubject } from "./subject";

export type View = (p: { lang: Lang; state: string; q: URLSearchParams }) => any;

/** `scroll=<px>` scrolls the page once it has painted, for a still further down. */
function Scrolled({ children, q }: { children: React.ReactNode; q: URLSearchParams }) {
  const scroll = Number(q.get("scroll") ?? 0);

  useEffect(() => {
    if (!scroll) return;
    const timer = setTimeout(() => window.scrollTo(0, scroll), 200);
    return () => clearTimeout(timer);
  }, [scroll]);

  return children;
}

export const views: Record<string, View> = {
  "exam-plan": ({ lang, q, state }) => (
    <Scrolled q={q}>
      <ExamPlan lang={lang} state={state} />
    </Scrolled>
  ),
  "exam-subject": ({ lang, q }) => (
    <Scrolled q={q}>
      <ExamSubject lang={lang} q={q} />
    </Scrolled>
  ),
  "mock-run": ({ lang }) => <Mock lang={lang} state="running" />,
  "mock-result": ({ lang, q }) => (
    <Scrolled q={q}>
      <Mock lang={lang} state="finished" />
    </Scrolled>
  ),
  mistakes: ({ lang, q }) => (
    <Scrolled q={q}>
      <Mistakes lang={lang} q={q} />
    </Scrolled>
  ),
};
