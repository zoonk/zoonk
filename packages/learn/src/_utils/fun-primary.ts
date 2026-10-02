import { useExperienceMode } from "../mode-provider";

/**
 * The main action of a sheet, a dialog or a form: the usual dark button in Focus and the lime pill
 * in Fun. Sheets and dialogs render in portals, outside `ModeProvider`, and form submit buttons
 * don't take a variant, so they read the mode that `ModeProvider` mirrors on `<html>` through CSS
 * instead of `usePrimaryVariant`.
 */
export const FUN_PRIMARY_BUTTON_CLASS =
  "in-data-[mode=fun]:bg-fun-lime in-data-[mode=fun]:text-fun-lime-foreground in-data-[mode=fun]:shadow-fun-lime in-data-[mode=fun]:hover:bg-fun-lime/90 in-data-[mode=fun]:font-bold in-data-[mode=fun]:focus-visible:ring-fun-fg in-data-[mode=fun]:focus-visible:ring-2 in-data-[mode=fun]:focus-visible:ring-offset-2 in-data-[mode=fun]:focus-visible:ring-offset-background";

/** The button variant for a screen's main action: the lime pill in Fun, the primary button in Focus. */
export function usePrimaryVariant(): "default" | "lime" {
  return useExperienceMode() === "fun" ? "lime" : "default";
}
