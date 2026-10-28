"use client";

import { type ExamMockSummary } from "@zoonk/core/exams/view/contract";
import { useExtracted } from "next-intl";
import { DetailAsideSection } from "../_components/detail-page";
import { ListGroup } from "../_components/list-group";
import { MockSummaryRow } from "./mock-summary-row";

export function ChooserLastMock({
  mock,
  resultHref,
}: {
  mock: ExamMockSummary | null;
  resultHref: (id: string) => string;
}) {
  const t = useExtracted();

  if (!mock) {
    return null;
  }

  return (
    <DetailAsideSection
      className="max-[72rem]:hidden"
      title={t("Your last mock exam")}
      titleId="mock-chooser-last-mock-title"
    >
      <ListGroup>
        <MockSummaryRow href={mock.blockId ? resultHref(mock.blockId) : null} mock={mock} stacked />
      </ListGroup>
    </DetailAsideSection>
  );
}
