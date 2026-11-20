"use client";

import { useExtracted } from "next-intl";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { FactSegments } from "../_components/task-meta";
import { useFocusTestRowFacts } from "../focus-test/use-focus-test-texts";
import { usePlanScreen } from "./plan-context";
import { usePlanCoverage } from "./plan-coverage";

/**
 * Where the test opens, for a learner who hasn't started it and whose time doesn't cover
 * everything: where a focus would help most.
 */
export function useFocusTestOfferHref(): string | null {
  const { focusTestHref, plan } = usePlanScreen();
  const coverage = usePlanCoverage();
  const offered = coverage && plan.focusTest?.state === "notStarted" && plan.focusTest.offer;

  return (offered && focusTestHref) || null;
}

export function useTakeFocusTestLabel(): string {
  const t = useExtracted();

  return t({
    description: "Link that opens the Focus test, for a learner who has not taken it.",
    message: "Take the Focus test",
  });
}

export function PlanFocusTest() {
  const t = useExtracted();
  const rowFacts = useFocusTestRowFacts();
  const { focusTestHref, plan } = usePlanScreen();
  const { focusTest } = plan;

  if (!focusTest || !focusTestHref) {
    return null;
  }

  return (
    <ListRowLink href={focusTestHref}>
      <ListRowContent>
        <ListRowTitle>{t("Focus test")}</ListRowTitle>
        <ListRowDescription>
          <FactSegments facts={rowFacts(focusTest)} />
        </ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}
