"use client";

import { type FocusTestSummary } from "@zoonk/core/learner/placement/focus-test-contract";
import { Button } from "@zoonk/ui/components/button";
import { CrosshairIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { ChangeSaveError } from "../_components/save-error";
import { FactSegments } from "../_components/task-meta";
import { useSentenceSpace } from "../_utils/locale";
import { useFormatDuration } from "../_utils/time-format";
import { useFocusTestStateFacts } from "../focus-test/use-focus-test-texts";
import { usePlanScreen } from "./plan-context";
import { usePlanCoverage } from "./plan-coverage";

/** The test as it stands after the switch; null when it wasn't saved. */
export type SetTestQuestions = (
  sessionQuestions: "on" | "paused",
) => Promise<FocusTestSummary | null>;

/**
 * The test's first sitting, for a learner who hasn't started it and whose time doesn't cover
 * everything: where a focus would help most.
 */
export function useFocusTestOffer(): { href: string; minutes: number } | null {
  const { focusTestHref, plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const { focusTest } = plan;

  return focusTestHref && coverage && focusTest?.state === "notStarted" && focusTest.offer
    ? { href: focusTestHref, minutes: focusTest.offer.minutes }
    : null;
}

export function useCheckFocusLabel() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (minutes: number): string =>
    t("Check where to focus · About {time}", { time: formatDuration(minutes) });
}

/** Said only while sessions ask the test's questions, or the learner paused them. */
function TestQuestionsSwitch({
  onChange,
  sessionQuestions,
}: {
  onChange: (sessionQuestions: "on" | "paused") => void;
  sessionQuestions: FocusTestSummary["sessionQuestions"];
}) {
  const t = useExtracted();
  const space = useSentenceSpace();
  const paused = sessionQuestions === "paused";

  if (sessionQuestions === "off") {
    return null;
  }

  return (
    <p className="text-muted-foreground ps-7 text-xs text-pretty">
      {paused
        ? t("Test questions in your sessions are paused.")
        : t("Your sessions ask a few test questions until every subject has an answer.")}
      {space}
      <Button onClick={() => onChange(paused ? "on" : "paused")} variant="link">
        {paused ? t("Ask them again") : t("Pause test questions")}
      </Button>
    </p>
  );
}

export function PlanFocusTest({ onSetTestQuestions }: { onSetTestQuestions?: SetTestQuestions }) {
  const t = useExtracted();
  const stateFacts = useFocusTestStateFacts();
  const { focusTestHref, plan } = usePlanScreen();
  const [switched, setSwitched] = useState<FocusTestSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const focusTest = switched ?? plan.focusTest;

  if (!focusTest || !focusTestHref) {
    return null;
  }

  const setTestQuestions = (sessionQuestions: "on" | "paused") =>
    startTransition(async () => {
      const saved = (await onSetTestQuestions?.(sessionQuestions).catch(() => null)) ?? null;
      setFailed(!saved);

      if (saved) {
        setSwitched(saved);
      }
    });

  return (
    <div className="flex flex-col gap-1" data-slot="plan-focus-test">
      <ListRowLink href={focusTestHref}>
        <ListRowLeading>
          <ListRowIcon>
            <CrosshairIcon />
          </ListRowIcon>
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Focus test")}</ListRowTitle>
          <ListRowDescription>
            <FactSegments facts={stateFacts(focusTest)} />
          </ListRowDescription>
        </ListRowContent>
      </ListRowLink>

      {onSetTestQuestions && (
        <TestQuestionsSwitch
          onChange={setTestQuestions}
          sessionQuestions={focusTest.sessionQuestions}
        />
      )}

      {failed && <ChangeSaveError className="ps-7" />}
    </div>
  );
}
