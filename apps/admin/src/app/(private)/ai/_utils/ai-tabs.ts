export const AI_TABS = [
  { label: "Spend", value: "spend" },
  { label: "Failed or stuck", value: "failed" },
  { label: "Plus learners", value: "plus" },
  { label: "Written by", value: "written" },
] as const;

export type AiTab = (typeof AI_TABS)[number]["value"];
