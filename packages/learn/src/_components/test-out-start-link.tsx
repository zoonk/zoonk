"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useSentenceSpace } from "../_utils/locale";
import { SENTENCE_WITH_ACTION_CLASS } from "../_utils/sentence-action";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { type HelpLimit, HelpLimitNotice } from "./help-limit-notice";
import { KindDot } from "./kind-tile";
import {
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
} from "./list-group";
import { StatusRegion } from "./status-region";

export type TestOutStart =
  | { limit: HelpLimit; status: "refused" }
  | { status: "failed" | "started" };

export function useTestOutStart(onStart: () => Promise<TestOutStart>) {
  const [result, setResult] = useState<TestOutStart | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => setResult(null), []);

  const start = () => {
    startTransition(async () => {
      setResult(await onStart().catch((): TestOutStart => ({ status: "failed" })));
    });
  };

  return { isPending, opening: isPending || result?.status === "started", result, start };
}

export function TestOutStartStatus({
  className,
  compact = false,
  isPending,
  result,
}: {
  className?: string;
  compact?: boolean;
  isPending: boolean;
  result: TestOutStart | null;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const shown = isPending ? null : result;

  return (
    <StatusRegion className={className} data-slot="test-out-start-status">
      {shown?.status === "refused" && (
        <HelpLimitNotice limit={shown.limit} linkComponent={LearnLink} routes={routes} />
      )}

      {shown?.status === "failed" && (
        <p className={cn("text-muted-foreground", compact ? "text-xs leading-4" : "text-sm")}>
          {t("The test didn't open. Try again.")}
        </p>
      )}
    </StatusRegion>
  );
}

/**
 * Always a chapter's test, so it says so wherever it shows. Where nothing on screen names the
 * chapter the next lesson starts, `nextChapter` says it's that one.
 */
export function TestOutStartLink({
  compact = false,
  nextChapter = false,
  onStart,
}: {
  compact?: boolean;
  nextChapter?: boolean;
  onStart: () => Promise<TestOutStart>;
}) {
  const t = useExtracted();
  const { isPending, opening, result, start } = useTestOutStart(onStart);
  const space = useSentenceSpace();

  return (
    <div className={cn("flex flex-col items-start", compact ? "relative gap-px" : "gap-2")}>
      <p
        className={cn(
          "text-muted-foreground",
          compact ? "text-xs leading-4" : "text-sm",
          SENTENCE_WITH_ACTION_CLASS,
        )}
      >
        {nextChapter ? t("Already know the next chapter?") : t("Already know this chapter?")}
        {space}
        <Button busy={opening} className="text-[length:inherit]" onClick={start} variant="link">
          {t("Take the test")}
        </Button>
      </p>

      <TestOutStartStatus compact={compact} isPending={isPending} result={result} />
    </div>
  );
}

function TestOutRowContent({ opening, scope }: { opening: boolean; scope: "chapter" | "unit" }) {
  const t = useExtracted();

  return (
    <ListRowContent>
      <ListRowTitle>{t("Already know this?")}</ListRowTitle>
      <ListRowDescription>
        {opening && t("Opening the test…")}
        {!opening && scope === "chapter" && t("Take the test and skip the chapter")}
        {!opening && scope === "unit" && t("Take the test and skip the unit")}
      </ListRowDescription>
    </ListRowContent>
  );
}

export function TestOutStartRow({
  onStart,
  scope,
}: {
  onStart: () => Promise<TestOutStart>;
  scope: "chapter" | "unit";
}) {
  const { isPending, opening, result, start } = useTestOutStart(onStart);

  return (
    <>
      <ListRowButton disabled={opening} onClick={start}>
        <ListRowLeading>
          <KindDot kind="practice" />
        </ListRowLeading>
        <TestOutRowContent opening={opening} scope={scope} />
      </ListRowButton>

      <TestOutStartStatus
        className="in-data-[list=panel]:px-4 [&:has(>*)]:pb-3"
        isPending={isPending}
        result={result}
      />
    </>
  );
}
