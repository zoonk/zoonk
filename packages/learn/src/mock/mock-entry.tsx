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
import { type MockEntryHrefs, getMockEntryTarget } from "./mock-entry-target";

export { getMockEntryTarget } from "./mock-entry-target";

/** The buddy's offer card names what a mock exam can be; the rows that open the chooser don't. */
export function useMockEntryDescription({ bySubject }: { bySubject: boolean }): string {
  const t = useExtracted();

  return bySubject
    ? t("The full exam, half of it or one subject")
    : t("The full exam or half of it");
}

export function MockEntryRow({ hrefs, view }: { hrefs: MockEntryHrefs; view: MockOptionsView }) {
  const t = useExtracted();
  const target = getMockEntryTarget({ hrefs, view });

  if (!target) {
    return null;
  }

  return (
    <ListRowLink href={target.href}>
      <ListRowLeading>
        <KindDot kind="mock" />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>
          {target.resume ? t("Continue your mock exam") : t("Take a mock exam")}
        </ListRowTitle>
      </ListRowContent>
    </ListRowLink>
  );
}

/** `runningId`: a mock the plan started, which the exam page lists and the chooser's view doesn't. */
export function MockEntryButton({
  hrefs,
  runningId,
  view,
}: {
  hrefs: MockEntryHrefs;
  runningId?: string | null;
  view: MockOptionsView;
}) {
  const t = useExtracted();
  const target = getMockEntryTarget({ hrefs, runningId, view });

  if (!target) {
    return null;
  }

  return (
    <EnterLink className={DETAIL_PRIMARY_CLASS} href={target.href} size="lg">
      {target.resume ? t("Continue your mock exam") : t("Take a mock exam")}
    </EnterLink>
  );
}
