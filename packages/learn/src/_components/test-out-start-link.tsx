"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useSentenceSpace } from "../_utils/locale";
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
import { StatusRegion } from "./status-region";

export type TestOutStart =
  | { limit: HelpLimit; status: "refused" }
  | { status: "failed" | "plusRequired" | "started" };

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

export function TestOutStartStatus({
  className,
  isPending,
  result,
}: {
  className?: string;
  isPending: boolean;
  result: TestOutStart | null;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const shown = isPending ? null : result;

  return (
    <StatusRegion className={className}>
      {shown?.status === "refused" && (
        <HelpLimitNotice limit={shown.limit} linkComponent={LearnLink} routes={routes} />
      )}

      {shown?.status === "plusRequired" && <FreeWeekOverNotice />}

      {shown?.status === "failed" && (
        <p className="text-muted-foreground text-sm">
          {t("That didn't work. Try again in a moment.")}
        </p>
      )}
    </StatusRegion>
  );
}

export function TestOutStartLink({
  className,
  onStart,
}: {
  className?: string;
  onStart: () => Promise<TestOutStart>;
}) {
  const t = useExtracted();
  const { isPending, opening, result, start } = useTestOutStart(onStart);
  const space = useSentenceSpace();

  return (
    <div className="flex flex-col items-start gap-2">
      <p className={cn("text-muted-foreground text-sm", className)}>
        {t("Already know this?")}
        {space}
        <Button disabled={opening} focusableWhenDisabled onClick={start} variant="link">
          {opening ? t("Opening the test…") : t("Take the test")}
        </Button>
      </p>

      <TestOutStartStatus isPending={isPending} result={result} />
    </div>
  );
}

export function TestOutStartRow({
  onStart,
  plusRequired = false,
  scope,
}: {
  onStart: () => Promise<TestOutStart>;
  plusRequired?: boolean;
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

      <TestOutStartStatus
        className="in-data-[list=panel]:px-4 [&:has(>*)]:pb-3"
        isPending={isPending}
        result={result}
      />
    </>
  );
}
