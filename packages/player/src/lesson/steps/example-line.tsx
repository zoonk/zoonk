"use client";

import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { UserRoundIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { LessonRichText } from "../_components/lesson-rich-text";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { type ExampleLine as ExampleLineRead } from "../lesson-player-types";

/**
 * Where the screen's example stands: being read, shown, offered (and whether the last request
 * failed), written as none since nothing the learner shared fits, or nothing to show or offer.
 */
type Example =
  | { status: "none" | "nothingFits" | "reading" }
  | { failed: boolean; status: "offered" }
  | { line: string; status: "shown" };

/** What a read says: the saved line, the offer when asking can write one, or nothing. */
function fromRead(read: ExampleLineRead | null): Example {
  if (read?.line) {
    return { line: read.line, status: "shown" };
  }

  return read?.canRequest ? { failed: false, status: "offered" } : { status: "none" };
}

/** What a request says: the line, that nothing fits, or that it failed (the offer stays). */
function fromRequest(requested: ExampleLineRead | null): Example {
  if (!requested) {
    return { failed: true, status: "offered" };
  }

  return requested.line ? { line: requested.line, status: "shown" } : { status: "nothingFits" };
}

/**
 * The personal example under an explanation: one sentence about the learner's own life. Saved lines
 * load after the screen shows. A missing line is offered only when asking can write one (the
 * learner shares something and no line was written from it yet), and it's written only when the
 * learner asks.
 */
export function ExampleLine({ stepId }: { stepId: string }) {
  const t = useExtracted();
  const { adapters } = useLessonPlayerConfig();
  const { getExampleLine, requestExampleLine } = adapters;
  const [isPending, startTransition] = useTransition();

  const [example, setExample] = useState<Example>(() =>
    getExampleLine ? { status: "reading" } : { status: "none" },
  );

  useEffect(() => {
    if (!getExampleLine) {
      return;
    }

    const read = { isCurrent: true };

    void safeAsync(() => getExampleLine({ stepId })).then(({ data }) => {
      if (read.isCurrent) {
        setExample(fromRead(data ?? null));
      }
    });

    return () => {
      read.isCurrent = false;
    };
  }, [getExampleLine, stepId]);

  function request() {
    if (!requestExampleLine) {
      return;
    }

    startTransition(async () => {
      const { data } = await safeAsync(() => requestExampleLine({ stepId }));
      setExample(fromRequest(data ?? null));
    });
  }

  if (example.status === "shown") {
    return (
      <aside
        aria-label={t("Your example")}
        className="bg-muted/60 motion-safe:animate-in motion-safe:fade-in flex items-start gap-3 rounded-xl p-4 text-base leading-relaxed"
      >
        <UserRoundIcon aria-hidden="true" className="text-muted-foreground mt-1 size-4 shrink-0" />
        <p>
          <LessonRichText text={example.line} />
        </p>
      </aside>
    );
  }

  if (example.status === "nothingFits") {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("Nothing you've shared fits this idea.")}
      </p>
    );
  }

  if (example.status !== "offered" || !requestExampleLine) {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-2" data-slot="example-line-offer">
      <Button disabled={isPending} onClick={request} size="sm" variant="ghost">
        <UserRoundIcon aria-hidden="true" />
        {isPending ? t("Writing your example…") : t("Show an example from my life")}
      </Button>
      {example.failed && !isPending && (
        <p className="text-muted-foreground text-sm" role="status">
          {t("No example is available right now.")}
        </p>
      )}
    </div>
  );
}
