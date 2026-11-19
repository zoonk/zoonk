import { useExtracted } from "next-intl";

/**
 * The line under a goal's progress percent. The percent counts lessons studied and those the
 * learner already knew, so once there are known ones the line names both.
 */
export function useLessonsProgressLine() {
  const t = useExtracted();

  return ({ known, studied }: { known: number; studied: number }): string =>
    known > 0
      ? t("{studied, number} studied · {known, number} already known", { known, studied })
      : t({
          description: "A short line under the progress percent, in a small tile.",
          message:
            "{studied, plural, =0 {No lessons studied yet} one {# lesson studied} other {# lessons studied}}",
          values: { studied },
        });
}
