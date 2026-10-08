"use client";

import { FastForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { type HelpLimit, HelpLimitNotice } from "./help-limit-notice";
import { KindTile } from "./kind-tile";
import {
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "./list-group";

/**
 * How asking for a chapter's test-out went. `started` means the host already opened it; a
 * refusal says what the learner's AI help allows.
 */
export type TestOutStart =
  | { limit: HelpLimit; status: "refused" }
  | { status: "failed" | "started" };

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

/** What a tap that didn't open the test says: the AI help limit, or to try again. */
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

  if (result?.status === "failed" && !isPending) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {t("That didn't work. Try again in a moment.")}
      </p>
    );
  }

  return null;
}

/** "Already know this? Take the test": nothing asks first. */
export function TestOutStartLink({ onStart }: { onStart: () => Promise<TestOutStart> }) {
  const t = useExtracted();
  const { isPending, opening, result, start } = useTestOutStart(onStart);

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-muted-foreground text-sm">
        {t("Already know this?")}{" "}
        <button
          className="text-foreground focus-visible:ring-ring/50 -my-2 inline-flex min-h-11 items-center rounded font-medium underline underline-offset-4 outline-none focus-visible:ring-[3px] disabled:opacity-60"
          disabled={opening}
          onClick={start}
          type="button"
        >
          {opening ? t("Opening the test…") : t("Take the test")}
        </button>
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
  scope,
}: {
  onStart: () => Promise<TestOutStart>;
  /** What passing the test skips, as the page calls it. */
  scope: "chapter" | "unit";
}) {
  const t = useExtracted();
  const { isPending, opening, result, start } = useTestOutStart(onStart);

  return (
    <>
      <ListRowButton disabled={opening} onClick={start}>
        <ListRowLeading>
          <KindTile icon={FastForwardIcon} kind="practice" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Already know this?")}</ListRowTitle>
          <ListRowDescription>
            {opening && t("Opening the test…")}
            {!opening && scope === "chapter" && t("Take the test and skip the chapter")}
            {!opening && scope === "unit" && t("Take the test and skip the unit")}
          </ListRowDescription>
        </ListRowContent>
      </ListRowButton>

      <div className="px-4 empty:hidden [&:has(>*)]:pb-3">
        <TestOutStartStatus isPending={isPending} result={result} />
      </div>
    </>
  );
}
