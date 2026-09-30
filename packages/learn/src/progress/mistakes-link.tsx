"use client";

import { NotebookPenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useProgressScreen } from "./progress-context";
import { ProgressLinkRow } from "./progress-link-row";

/** The mistakes notebook lives under Progress, where learners look for what to fix. */
export function MistakesLink() {
  const t = useExtracted();
  const { hrefs, progress } = useProgressScreen();
  const { open } = progress.mistakes;

  return (
    <ProgressLinkRow
      href={hrefs.mistakes}
      icon={NotebookPenIcon}
      subtitle={t("{open, plural, =0 {Nothing to fix right now} one {# to fix} other {# to fix}}", {
        open,
      })}
      title={t("Mistakes notebook")}
    />
  );
}
