import { cn } from "@zoonk/ui/lib/utils";
import { CHOICE_CARD_PICKED_CLASS } from "../onboarding/choice-styles";

export const PLAN_OPTION_CLASS = cn(
  "border-border flex min-h-11 min-w-max flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm",
  CHOICE_CARD_PICKED_CLASS,
);
