"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { FreeWeekOverNotice } from "./free-week-over";
import { type HelpLimit, HelpLimitNotice } from "./help-limit-notice";
import { KindDot } from "./kind-tile";
import {
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "./list-group";
import { PlusMark } from "./plus-lock";

/**
 * How asking for a chapter's test-out went. `started` means the host already opened it; a
 * refusal says what the learner's AI help allows, and `plusRequired` that a free exam plan past
 * its first week takes it with Plus only.
 */
export type TestOutStart =
  | { limit: HelpLimit; status: "refused" }
  | { status: "failed" | "plusRequired" | "started" };

/**
 * One tap asks for the test's questions and opens it, where they're written while the learner
 * watches when they don't exist yet. `opening` stays on once the host opened it, until the screen
 * is left: coming back to it (a screen kept in the background, as Today is) offers the test again
 * instead of still opening it.
 */
export function useTestOutStart(onStart: () => Promise<TestOutStart>) {
  const [result, setResult] = useState<TestOutStart | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => setResult(null), []);

  const start = () =>
    startTransition(async () => {
      setResult(await onStart());
    });

  return { isPending, opening: isPending || result?.status === "started", result, start };
}

/**
 * What a tap that didn't open the test says: the AI help limit, the end of a free exam plan's
 * first week, or to try again.
 */
export function TestOutStartStatus({
  isPending,
  result,
}: {
  isPending: boolean;
  result: TestOutStart | null;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();

  if (result?.status === "refused") {
    return <HelpLimitNotice limit={result.limit} linkComponent={LearnLink} routes={routes} />;
  }

  if (result?.status === "plusRequired") {
    return <FreeWeekOverNotice />;
  }

  if (result?.status === "failed" && !isPending) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("That didn't work. Try again in a moment.")}
      </p>
    );
  }

  return null;
}

/**
 * "Already know this? Take the test": a quiet line, its action in the text color; nothing asks
 * first.
 */
export function TestOutStartLink({
  className,
  onStart,
}: {
  /** The line's size and room: 14px by default, 12px as a third line of Today's next block. */
  className?: string;
  onStart: () => Promise<TestOutStart>;
}) {
  const t = useExtracted();
  const { isPending, opening, result, start } = useTestOutStart(onStart);

  return (
    <div className="flex flex-col items-start gap-2">
      <p className={cn("text-muted-foreground text-sm", className)}>
        {t("Already know this?")}{" "}
        <Button disabled={opening} onClick={start} variant="link">
          {opening ? t("Opening the test…") : t("Take the test")}
        </Button>
      </p>

      <TestOutStartStatus isPending={isPending} result={result} />
    </div>
  );
}

/**
 * "Already know this? Take the test and skip the chapter" as a row of its page's list
 * (`ListGroup`), with what a tap that didn't open the test says under it.
 */
export function TestOutStartRow({
  onStart,
  plusRequired = false,
  scope,
}: {
  onStart: () => Promise<TestOutStart>;
  /** A free exam plan past its first week takes it with Plus only: marked Plus, as its lessons. */
  plusRequired?: boolean;
  /** What passing the test skips, as the page calls it. */
  scope: "chapter" | "unit";
}) {
  const t = useExtracted();
  const { isPending, opening, result, start } = useTestOutStart(onStart);

  return (
    <>
      <ListRowButton disabled={opening} onClick={start}>
        <ListRowLeading>
          <KindDot kind="practice" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle className="flex items-center gap-2">
            {t("Already know this?")}
            {plusRequired && <PlusMark />}
          </ListRowTitle>
          <ListRowDescription>
            {opening && t("Opening the test…")}
            {!opening && scope === "chapter" && t("Take the test and skip the chapter")}
            {!opening && scope === "unit" && t("Take the test and skip the unit")}
          </ListRowDescription>
        </ListRowContent>
      </ListRowButton>

      <div className="empty:hidden in-data-[list=panel]:px-4 [&:has(>*)]:pb-3">
        <TestOutStartStatus isPending={isPending} result={result} />
      </div>
    </>
  );
}
