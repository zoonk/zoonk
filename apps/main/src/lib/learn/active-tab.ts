import { type LearnTab } from "@zoonk/learn/navigation";

/**
 * A tab is current on its own page and on the pages it opens (a subject, a chapter or a unit from
 * the Plan). A page the sidebar lists on its own (the notebook, mind maps, the exam, speaking,
 * statistics) belongs to no tab, on a phone as in the sidebar, which marks that page's own row.
 */
const TAB_BY_PATH: Record<string, LearnTab> = {
  buddy: "buddy",
  content: "journey",
  plan: "journey",
  today: "today",
};

export function getActiveTab(pathname: string): LearnTab | null {
  const [, first = ""] = pathname.split("/");
  return TAB_BY_PATH[first] ?? null;
}
