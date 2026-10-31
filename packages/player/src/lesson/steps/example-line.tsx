"use client";

import { safeAsync } from "@zoonk/utils/error";
import { UserRoundIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { LessonRichText } from "../_components/lesson-rich-text";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { type LessonPlayerAdapters } from "../lesson-player-types";

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
