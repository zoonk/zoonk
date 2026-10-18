import { cn } from "@zoonk/ui/lib/utils";
import { CHOICE_CARD_PICKED_CLASS } from "../onboarding/choice-styles";

/**
 * A plan option as a card with its radio (an exam's choices, the essay's cadence), picked as every
 * pick is. Options share the row but never squeeze a label onto two lines; they wrap instead.
 */
export const PLAN_OPTION_CLASS = cn(
  "border-border flex min-h-11 min-w-max flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm",
  CHOICE_CARD_PICKED_CLASS,
);
