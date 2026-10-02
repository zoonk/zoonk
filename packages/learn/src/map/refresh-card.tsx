"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PracticeOutcomeMessage } from "../_components/practice-outcome-message";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { usePracticeRun } from "../_utils/use-practice-run";
import { useFieldMap } from "./field-map-context";
import { FADING_OUTLINE } from "./skill-state";

/** Enough fading skills to name at a glance; the map shows every one. */
const MAX_NAMED_SKILLS = 6;

/**
 * Refresh mode: the skills fading now and one action that practices them. A refresh goal leads
 * with it; for any other goal it's a quiet offer, and it stays away while nothing fades.
 */
export function RefreshCard() {
  const t = useExtracted();
  const primaryVariant = usePrimaryVariant();
  const { actions, map } = useFieldMap();
  const { emphasized, skills } = map.refresh;
  const { isPending, outcome, practice } = usePracticeRun(actions.refresh);

  if (skills.length === 0 && !emphasized) {
    return null;
  }

  return (
    <section
      aria-labelledby="refresh-title"
      className={cn(
        "in-data-[mode=fun]:fun-glass flex flex-col gap-3 rounded-3xl p-4",
        emphasized ? "bg-muted" : "border",
      )}
    >
      <div className="flex items-start gap-3">
        <RotateCcwIcon aria-hidden="true" className="text-warning mt-0.5 size-5 shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-semibold" id="refresh-title">
            {skills.length > 0
              ? t("{count, plural, one {# skill is fading} other {# skills are fading}}", {
                  count: skills.length,
                })
              : t("Nothing is fading right now")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {skills.length > 0
              ? t("A few questions on each one brings it back.")
              : t("Your reviews keep it that way. Come back when something fades.")}
          </p>
        </div>
      </div>

      {skills.length > 0 && (
        <>
          <ul className="flex flex-wrap gap-2">
            {skills.slice(0, MAX_NAMED_SKILLS).map((skill) => (
              <li
                // Rounded, not a pill: a long skill name takes two lines on a phone.
                className={cn("rounded-2xl border px-3 py-1 text-sm", FADING_OUTLINE)}
                key={skill.skillId}
              >
                {skill.name}
              </li>
            ))}
          </ul>
          <Button
            className="self-start"
            disabled={isPending}
            onClick={practice}
            variant={emphasized ? primaryVariant : "outline"}
          >
            {t("Refresh now")}
          </Button>
          <PracticeOutcomeMessage
            dailyCap={t(
              "That's all the bonus practice for today. Your reviews bring these back too.",
            )}
            nothingToPractice={t(
              "Today's reviews already bring these back, and there's nothing more to practice on them today.",
            )}
            outcome={outcome}
          />
        </>
      )}
    </section>
  );
}
