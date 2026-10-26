"use client";

import { safeAsync } from "@zoonk/utils/error";
import { UserRoundIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { LessonRichText } from "../_components/lesson-rich-text";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { type LessonPlayerAdapters } from "../lesson-player-types";

/**
 * The screen's line, read after the lesson's background write (once one started) settles, so the
 * read sees what it wrote. Null when the read didn't go through.
 */
async function readExampleLine({
  getExampleLine,
  stepId,
  writing,
}: {
  getExampleLine: NonNullable<LessonPlayerAdapters["getExampleLine"]>;
  stepId: string;
  writing: Promise<unknown> | null;
}) {
  await writing;
  const { data } = await safeAsync(() => getExampleLine({ stepId }));
  return data ?? null;
}

/**
 * The personal example under an explanation: one sentence about the learner's own life, set apart
 * by a rule on its leading edge, as a shared text is, rather than a box. The lesson writes its lines
 * in the background (`useExampleLines`), so the line simply appears once it's there, without
 * animating in, and a screen without one stays as it is, with nothing to ask for or explain.
 */
export function ExampleLine({ stepId }: { stepId: string }) {
  const t = useExtracted();
  const { adapters, exampleLinesWriting } = useLessonPlayerConfig();
  const { getExampleLine } = adapters;
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    if (!getExampleLine) {
      return;
    }

    const read = { isCurrent: true };

    // A read that didn't go through keeps what the screen shows.
    void readExampleLine({ getExampleLine, stepId, writing: exampleLinesWriting }).then((data) => {
      if (read.isCurrent && data) {
        setLine(data.line);
      }
    });

    return () => {
      read.isCurrent = false;
    };
  }, [exampleLinesWriting, getExampleLine, stepId]);

  if (!line) {
    return null;
  }

  return (
    <aside
      aria-label={t("Your example")}
      className="border-border flex items-start gap-3 border-s-2 ps-4 text-base leading-relaxed"
    >
      <UserRoundIcon aria-hidden="true" className="text-muted-foreground mt-1 size-4 shrink-0" />
      <p>
        <LessonRichText text={line} />
      </p>
    </aside>
  );
}
