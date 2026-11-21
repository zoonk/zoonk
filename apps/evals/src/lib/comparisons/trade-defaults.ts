import { type TaskPriorities } from "./schemas";

type Trade = NonNullable<NonNullable<TaskPriorities["comparison"]>["trade"]>;

export const COMPARISON_TRADES = {
  core: { majorIncreasePer100: 1, saveCostShare: 0.7, saveSeconds: null },
  private: { majorIncreasePer100: 5, saveCostShare: 0.3, saveSeconds: 1 },
  shared: { majorIncreasePer100: 3, saveCostShare: 0.5, saveSeconds: null },
} satisfies Record<string, Trade>;
