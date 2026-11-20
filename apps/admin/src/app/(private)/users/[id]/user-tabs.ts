export const USER_TABS = [
  { label: "Overview", value: "overview" },
  { label: "Plan", value: "plan" },
  { label: "Learning", value: "learning" },
  { label: "Memory", value: "memory" },
  { label: "Account", value: "account" },
] as const;

export type UserTab = (typeof USER_TABS)[number]["value"];
