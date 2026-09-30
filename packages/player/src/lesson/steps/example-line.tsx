"use client";

import { UserRoundIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { LessonRichText } from "../_components/lesson-rich-text";
import { useLessonPlayerConfig } from "../lesson-player-context";

/**
 * The personal example under an explanation: one sentence about the learner's own life. It loads
 * after the screen shows and simply appears; without one, the screen is complete as it is.
 */
export function ExampleLine({ stepId }: { stepId: string }) {
  const t = useExtracted();
  const { adapters } = useLessonPlayerConfig();
  const [line, setLine] = useState<string | null>(null);
  const getExampleLine = adapters.getExampleLine;

  useEffect(() => {
    if (!getExampleLine) {
      return;
    }

    const request = { isCurrent: true };

    void getExampleLine({ stepId }).then((text) => {
      if (request.isCurrent) {
        setLine(text);
      }
    });

    return () => {
      request.isCurrent = false;
    };
  }, [getExampleLine, stepId]);

  if (!line) {
    return null;
  }

  return (
    <aside
      aria-label={t("Your example")}
      className="bg-muted/60 motion-safe:animate-in motion-safe:fade-in flex items-start gap-3 rounded-2xl p-4 text-base leading-relaxed"
    >
      <UserRoundIcon aria-hidden="true" className="text-muted-foreground mt-1 size-4 shrink-0" />
      <p>
        <LessonRichText text={line} />
      </p>
    </aside>
  );
}
