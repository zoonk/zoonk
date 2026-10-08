"use client";

import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DETAIL_PRIMARY_CLASS } from "../_components/detail-page";
import { KindTile } from "../_components/kind-tile";
import {
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PlusMark } from "../_components/plus-lock";
import { LearnLink } from "../learn-link";

/**
 * What the learner can take (one subject too, when `bySubject`), the same for every plan: without
 * Plus, the row or card says it's locked with `PlusMark` instead. The exam's entry and the buddy's
 * offer say it alike.
 */
export function useMockEntryDescription({ bySubject }: { bySubject: boolean }): string {
  const t = useExtracted();

  return bySubject
    ? t("Whenever you want: the full exam, half of it or one subject")
    : t("Whenever you want: the full test or half of it");
}

/**
 * "Take a mock exam" whenever the learner wants, as a row of its page's list (`ListGroup`): what it
 * offers in a line (the full exam, half of it, one subject) and, when the learner's plan doesn't
 * include mocks, the Plus mark (the chooser it opens shows them locked, with what Plus unlocks), or
 * the mock they started, to continue it. Nothing while no mock can be built.
 */
export function MockEntryRow({
  hrefs,
  view,
}: {
  /** `choose`: the page to pick a mock; `mock`: a running mock, by its id. */
  hrefs: { choose: string; mock: (id: string) => string };
  view: MockOptionsView;
}) {
  const t = useExtracted();

  const description = useMockEntryDescription({
    bySubject: view.options.some((option) => option.kind === "area"),
  });

  // No mock can be built yet (a class test with no material and few questions): nothing to offer.
  if (!view.running && view.options.length === 0) {
    return null;
  }

  if (view.running) {
    return (
      <ListRowLink href={hrefs.mock(view.running.id)}>
        <ListRowLeading>
          <KindTile kind="mock" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Continue your mock exam")}</ListRowTitle>
          <ListRowDescription>{t("It's where you left it")}</ListRowDescription>
        </ListRowContent>
      </ListRowLink>
    );
  }

  return (
    <ListRowLink href={hrefs.choose}>
      <ListRowLeading>
        <KindTile kind="mock" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Take a mock exam")}</ListRowTitle>
        <ListRowDescription>{description}</ListRowDescription>
      </ListRowContent>
      {view.access === "plusRequired" && (
        <ListRowTrailing>
          <PlusMark />
        </ListRowTrailing>
      )}
    </ListRowLink>
  );
}

/**
 * "Take a mock exam" as a detail page's main action (the exam's page), with the timer of mocks and,
 * when the learner's plan doesn't include mocks, the Plus mark (the chooser shows them locked, with
 * what Plus unlocks); "Continue your mock exam" while one is running. Nothing while no mock can be
 * built.
 */
export function MockEntryButton({
  hrefs,
  view,
}: {
  hrefs: { choose: string; mock: (id: string) => string };
  view: MockOptionsView;
}) {
  const t = useExtracted();

  if (!view.running && view.options.length === 0) {
    return null;
  }

  return (
    <LearnLink
      className={DETAIL_PRIMARY_CLASS}
      href={view.running ? hrefs.mock(view.running.id) : hrefs.choose}
    >
      <TimerIcon aria-hidden="true" className="size-4" />
      {view.running ? t("Continue your mock exam") : t("Take a mock exam")}
      {view.access === "plusRequired" && !view.running && (
        <PlusMark className="bg-primary-foreground/15 text-primary-foreground" />
      )}
    </LearnLink>
  );
}
