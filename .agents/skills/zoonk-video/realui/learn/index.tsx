import { type ViewProps } from "./common";
import { GoalEntryView } from "./goal-entry";
import { views as onboarding } from "./onboarding";
import { views as plan } from "./plan";
import { views as today } from "./today";
import { views as zu } from "./zu";

export const views: Record<string, (p: ViewProps) => any> = {
  "goal-entry": GoalEntryView,
  ...onboarding,
  ...today,
  ...plan,
  ...zu,
};
