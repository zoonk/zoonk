"use client";

import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { useProgressScreen } from "./progress-context";

/** Skills fading right now. Reviews bring them back, so this is a nudge, never a warning. */
export function FadingSkills() {
  const t = useExtracted();
  const { progress } = useProgressScreen();

  if (progress.fading.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="fading-skills-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <SectionLabel id="fading-skills-title">{t("Fading")}</SectionLabel>
        <p className="text-muted-foreground text-sm">
          {t("Your reviews bring these back. They're already in your coming sessions.")}
        </p>
      </div>
      {/* Skill names run long, so each gets a full row rather than a pill that wraps. */}
      <ul className="bg-muted in-data-[mode=fun]:fun-glass divide-background in-data-[mode=fun]:divide-fun-track flex flex-col divide-y rounded-2xl">
        {progress.fading.map((skill) => (
          <li className="px-4 py-3 text-sm" key={skill.skillId}>
            {skill.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
