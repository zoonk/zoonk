"use client";

import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DETAIL_PRIMARY_CLASS } from "../_components/detail-page";
import { KindDot } from "../_components/kind-tile";
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

export function useMockEntryDescription({ bySubject }: { bySubject: boolean }): string {
  const t = useExtracted();

  return bySubject
    ? t("Whenever you want: a full exam day, half a day or one subject")
    : t("Whenever you want: a full exam day or half a day");
}

export function MockEntryRow({
  hrefs,
  view,
}: {
  hrefs: { choose: string; mock: (id: string) => string };
  view: MockOptionsView;
}) {
  const t = useExtracted();

  const description = useMockEntryDescription({
    bySubject: view.options.some((option) => option.kind === "area"),
  });

  if (!view.running && view.options.length === 0) {
    return null;
  }

  if (view.running) {
    return (
      <ListRowLink href={hrefs.mock(view.running.id)}>
        <ListRowLeading>
          <KindDot kind="mock" />
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
        <KindDot kind="mock" />
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
