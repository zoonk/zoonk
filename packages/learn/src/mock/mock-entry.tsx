"use client";

import { type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { DETAIL_PRIMARY_CLASS } from "../_components/detail-page";
import { EnterLink } from "../_components/enter-button";
import { KindDot } from "../_components/kind-tile";
import {
  ListRowContent,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";

/** The buddy's offer card names what a mock exam can be; the rows that open the chooser don't. */
export function useMockEntryDescription({ bySubject }: { bySubject: boolean }): string {
  const t = useExtracted();

  return bySubject
    ? t("The full exam, half of it or one subject")
    : t("The full exam or half of it");
}

export function MockEntryRow({
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

  if (view.running) {
    return (
      <ListRowLink href={hrefs.mock(view.running.id)}>
        <ListRowLeading>
          <KindDot kind="mock" />
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{t("Continue your mock exam")}</ListRowTitle>
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
      </ListRowContent>
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
    <EnterLink
      className={DETAIL_PRIMARY_CLASS}
      href={view.running ? hrefs.mock(view.running.id) : hrefs.choose}
      size="lg"
    >
      {view.running ? t("Continue your mock exam") : t("Take a mock exam")}
    </EnterLink>
  );
}
